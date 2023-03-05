# aws-credentials-manager
 Manage AWS IAM Passwords and Access Keys via CLI. The **aws-credentials-manager** will automatically scan your `~/.aws/credentials` file and list all profiles. You can then select a profile to manage the credentials for. The **aws-credentials-manager** will then prompt you to change your password or access keys. The **aws-credentials-manager** will automatically scan your `~/.aws/credentials` file for profiles to potentially update.

## Prerequisites
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- AWS Account with an IAM User
- An existing, valid AWS Access Key and Secret Key, set in your `~/.aws/credentials` file
- NodeJS 14.x or higher

## Installation
```bash
npm install -g aws-credentials-manager
```

## Usage

### Change Password
```bash
awscreds
```
