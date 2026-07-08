// Crossroad Threads — Static plane stack.
//
// Implements audit/LAUNCH-ARCHITECTURE.md §2.1 ("Static plane (the storefront)"):
//   Route 53 (DNS) -> CloudFront (CDN, TLS via ACM) -> S3 (private, OAC) : out/
//                              \-- /api/* behavior -> API Gateway / ALB -> commerce containers
//
// Deploy + basePath decoupling (DEPLOY_TARGET, default '' for AWS): see
// infra/cdk/README.md, which cites source/next.config.ts.
//
// All configuration values are inlined below (no external path reads at runtime).
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";

export class StaticStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- Inlined configuration (no external reads) ----
    const apexDomain = "crossroadthreads.com";
    const wwwDomain = `www.${apexDomain}`;
    // API origin for the /api/* behavior (API Gateway / ALB hostname).
    // Inlined per contract; replace with the real commerce API host.
    const apiOriginDomain = "api.crossroadthreads.com";

    // ---- Route 53 hosted zone (must already exist) ----
    const HostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: apexDomain,
    });

    // ---- ACM Certificate (CloudFront requires us-east-1; stack is pinned there) ----
    const Certificate = new acm.Certificate(this, "Certificate", {
      domainName: apexDomain,
      subjectAlternativeNames: [wwwDomain],
      validation: acm.CertificateValidation.fromDns(HostedZone),
    });

    // ---- Private S3 bucket (no public access; access only via CloudFront OAC) ----
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---- Origin Access Control (OAC): CloudFront-only access to the private bucket ----
    const OriginAccessControl = new cloudfront.S3OriginAccessControl(
      this,
      "OriginAccessControl",
      {
        signing: cloudfront.Signing.SIGV4_ALWAYS,
      }
    );

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
      originAccessControl: OriginAccessControl,
    });

    // ---- CloudFront Function: trailingSlash -> index.html rewrite + 301 to canonical host ----
    // Runtime pinned to JS_2_0 so ES6 string methods (endsWith/includes) are valid.
    const rewriteFunction = new cloudfront.Function(this, "Function", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment:
        "Rewrite directory paths to index.html (trailingSlash) and 301 to canonical apex host.",
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var host = headers.host && headers.host.value ? headers.host.value : '';
  var canonical = '${apexDomain}';

  // Canonical-host redirect: 301 www (or any non-canonical host) to the apex.
  if (host && host !== canonical) {
    var location = 'https://' + canonical + request.uri;
    if (request.querystring) {
      var qs = Object.keys(request.querystring)
        .map(function (k) { return k + '=' + request.querystring[k].value; })
        .join('&');
      if (qs) { location = location + '?' + qs; }
    }
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: location } }
    };
  }

  var uri = request.uri;
  // trailingSlash: true export -> directory paths map to /index.html.
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!uri.includes('.')) {
    request.uri = uri + '/index.html';
  }
  return request;
}
`),
    });

    // ---- API origin for the /api/* behavior (API Gateway / ALB) ----
    const apiOrigin = new origins.HttpOrigin(apiOriginDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // ---- CloudFront distribution: default -> S3, /api/* -> API origin ----
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "Crossroad Threads static plane (CloudFront + OAC + ACM).",
      defaultRootObject: "index.html",
      domainNames: [apexDomain, wwwDomain],
      certificate: Certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // ---- Route 53 A/AAAA alias records for apex and www ----
    // recordName is RELATIVE to the hosted zone. Apex uses zoneName; www uses the
    // bare 'www' label so records nest correctly (no domain-in-domain doubling).
    const cfTarget = route53.RecordTarget.fromAlias(
      new targets.CloudFrontTarget(distribution)
    );

    new route53.ARecord(this, "ApexAliasA", {
      zone: HostedZone,
      recordName: apexDomain, // equals zoneName -> apex record
      target: cfTarget,
    });
    new route53.AaaaRecord(this, "ApexAliasAAAA", {
      zone: HostedZone,
      recordName: apexDomain,
      target: cfTarget,
    });
    new route53.ARecord(this, "WwwAliasA", {
      zone: HostedZone,
      recordName: "www", // relative label -> www.crossroadthreads.com
      target: cfTarget,
    });
    new route53.AaaaRecord(this, "WwwAliasAAAA", {
      zone: HostedZone,
      recordName: "www",
      target: cfTarget,
    });

    // ---- Outputs ----
    new cdk.CfnOutput(this, "BucketName", { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });
    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "ApexUrl", { value: `https://${apexDomain}` });
  }
}
