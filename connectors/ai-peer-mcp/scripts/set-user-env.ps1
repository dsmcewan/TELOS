param(
  [switch]$SkipAnthropic,
  [switch]$SkipXai
)

$ErrorActionPreference = "Stop"

function Set-PlainUserEnv {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Prompt
  )

  $value = Read-Host $Prompt
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Host "$Name unchanged (blank input)."
    return
  }

  [Environment]::SetEnvironmentVariable($Name, $value.Trim(), "User")
  Write-Host "$Name set at Windows User scope."
}

function Set-SecretUserEnv {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Prompt
  )

  $secure = Read-Host $Prompt -AsSecureString
  if ($secure.Length -eq 0) {
    Write-Host "$Name unchanged (blank input)."
    return
  }

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($value)) {
      Write-Host "$Name unchanged (blank input)."
      return
    }

    [Environment]::SetEnvironmentVariable($Name, $value.Trim(), "User")
    Write-Host "$Name set at Windows User scope."
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Write-Host "AI Peer MCP environment setup"
Write-Host "Keys are stored in Windows User environment variables, not in vault files."
Write-Host "Leave a prompt blank to keep the current value unchanged."
Write-Host ""

if (-not $SkipAnthropic) {
  Set-SecretUserEnv -Name "ANTHROPIC_API_KEY" -Prompt "Enter ANTHROPIC_API_KEY"
  Set-PlainUserEnv -Name "ANTHROPIC_MODEL" -Prompt "Enter ANTHROPIC_MODEL"
}

if (-not $SkipXai) {
  Set-SecretUserEnv -Name "XAI_API_KEY" -Prompt "Enter XAI_API_KEY"
  Set-PlainUserEnv -Name "XAI_MODEL" -Prompt "Enter XAI_MODEL"
}

[Environment]::SetEnvironmentVariable("ANTHROPIC_VERSION", "2023-06-01", "User")
[Environment]::SetEnvironmentVariable("XAI_BASE_URL", "https://api.x.ai/v1", "User")

Write-Host ""
Write-Host "Done. Fully quit and reopen Codex Desktop so MCP servers inherit the new User environment."
Write-Host "Then ask: check ai_peer tools"
