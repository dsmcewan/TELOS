$vars = @(
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_VERSION",
  "XAI_API_KEY",
  "XAI_MODEL",
  "XAI_BASE_URL"
)

foreach ($name in $vars) {
  $value = [Environment]::GetEnvironmentVariable($name, "User")
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Host "$name=user:missing"
  }
  else {
    Write-Host "$name=user:set"
  }
}
