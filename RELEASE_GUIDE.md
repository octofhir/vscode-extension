# Release and Publishing Guide

This guide explains how to set up and use the automated release workflow for the OctoFHIR FHIRPath VSCode Extension.

## Overview

The extension uses GitHub Actions to automate the entire release process:
- Version bumping (patch, minor, major)
- Building and packaging the extension
- Creating GitHub releases
- Publishing to VSCode Marketplace
- Publishing to Open VSX Registry

## Prerequisites

### 1. VSCode Marketplace Personal Access Token

To publish to the VSCode Marketplace, you need a Personal Access Token (PAT):

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with your Microsoft account
3. Click on your profile picture → "Personal access tokens"
4. Click "New Token"
5. Configure the token:
   - **Name**: `VSCode Extension Publishing`
   - **Organization**: Select "All accessible organizations"
   - **Expiration**: Choose appropriate duration (recommend 1 year)
   - **Scopes**: Select "Custom defined" and check:
     - **Marketplace** → **Manage** (this gives publish permissions)
6. Click "Create"
7. **Important**: Copy the token immediately - you won't be able to see it again

### 2. Open VSX Registry Personal Access Token (Optional)

To also publish to Open VSX Registry (used by VSCodium, Gitpod, etc.):

1. Go to [Open VSX Registry](https://open-vsx.org/)
2. Sign in with your GitHub account
3. Go to your profile settings
4. Generate a new access token with publish permissions
5. Copy the token

### 3. Configure GitHub Secrets

Add the tokens as secrets in your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

   - **Name**: `VSCE_PAT`
   - **Value**: Your VSCode Marketplace Personal Access Token

   - **Name**: `OVSX_PAT` (optional)
   - **Value**: Your Open VSX Registry Personal Access Token

## How to Release

### Manual Release

1. Go to your repository on GitHub
2. Navigate to **Actions** tab
3. Select **"Release and Publish Extension"** workflow
4. Click **"Run workflow"**
5. Choose your options:
   - **Version bump type**: `patch` (0.1.0 → 0.1.1), `minor` (0.1.0 → 0.2.0), or `major` (0.1.0 → 1.0.0)
   - **Create pre-release**: Check if this is a pre-release version
6. Click **"Run workflow"**

### What Happens During Release

The workflow will:

1. **Setup Environment**
   - Checkout code
   - Setup Node.js 20 and pnpm
   - Install dependencies

2. **Quality Checks**
   - Run linting (`pnpm run lint`)
   - Build extension (`pnpm run compile`)

3. **Version Management**
   - Bump version in `package.json`
   - Create git tag
   - Commit and push changes

4. **Package and Release**
   - Create VSIX package
   - Create GitHub release
   - Upload VSIX to GitHub release

5. **Publish**
   - Publish to VSCode Marketplace (if `VSCE_PAT` is configured)
   - Publish to Open VSX Registry (if `OVSX_PAT` is configured)

## Troubleshooting

### Common Issues

#### "VSCE_PAT secret not set"
- The workflow will skip marketplace publishing if the secret isn't configured
- Add the `VSCE_PAT` secret as described above

#### "Authentication failed"
- Your Personal Access Token may have expired
- Generate a new token and update the secret

#### "Publisher not found"
- Ensure the `publisher` field in `package.json` matches your marketplace publisher ID
- Current publisher: `octofhir`

#### "Version already exists"
- The version you're trying to publish already exists
- Use a different version bump type or manually update the version

### Manual Publishing

If the automated workflow fails, you can publish manually:

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm run compile

# Package the extension
pnpm run package

# Publish to VSCode Marketplace
npx vsce publish

# Or publish a specific VSIX file
npx vsce publish path/to/extension.vsix
```

## Version Strategy

We recommend following semantic versioning:

- **Patch** (0.1.0 → 0.1.1): Bug fixes, small improvements
- **Minor** (0.1.0 → 0.2.0): New features, backwards compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes, major releases

## Security Notes

- Personal Access Tokens are sensitive - never commit them to code
- Use GitHub Secrets to store tokens securely
- Regularly rotate your tokens (recommended: every 6-12 months)
- Use minimal required permissions for tokens

## Monitoring Releases

- Check the **Actions** tab for workflow status
- Monitor the **Releases** page for published versions
- Verify publication on [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=octofhir.fhirpath-extension)
- Check [Open VSX Registry](https://open-vsx.org/extension/octofhir/fhirpath-extension) if publishing there

## Support

If you encounter issues with the release process:

1. Check the GitHub Actions logs for detailed error messages
2. Verify all secrets are properly configured
3. Ensure your tokens have the correct permissions
4. Check that the publisher ID matches your marketplace account
