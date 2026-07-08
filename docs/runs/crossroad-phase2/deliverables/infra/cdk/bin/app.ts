#!/usr/bin/env node
// Crossroad Threads — CDK app entrypoint for the static plane.
//
// Wires the StaticStack from audit/LAUNCH-ARCHITECTURE.md §2.1 ("Static plane").
// Deploy / basePath decoupling docs: see infra/cdk/README.md (DEPLOY_TARGET,
// default '' for AWS — cites source/next.config.ts).
//
// The ACM certificate for CloudFront must live in us-east-1, so the stack is
// pinned to us-east-1. All values are inlined in the stack (no external reads).
import * as cdk from "aws-cdk-lib";
import { StaticStack } from "../lib/static-stack";

const app = new cdk.App();

new StaticStack(app, "CrossroadThreadsStaticStack", {
  // CloudFront + ACM require the certificate in us-east-1.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  description:
    "Crossroad Threads static plane: private S3 + CloudFront (OAC) + ACM + Route 53.",
});

app.synth();
