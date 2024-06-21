# Account Kit Examples

These example scripts demonstrate various Gnosis Pay Safe-related operations, such as Safe setup and Safe message signing.

## Table of Contents

- [Project Setup](#project-setup)
- [Safe Creation](#safe-creation)
- [Safe Setup](#safe-setup)
- [Sign Safe Message](#sign-safe-message)

## Project Setup

### Install Dependencies

```bash

yarn

```

### Configuration

We provide a sample environment file called `.env.example`. Duplicate it and update the `.env` file with your private key.

```bash

cp .env.example .env

```

## Safe Creation

This command creates a Safe with the specified address as the owner (derived from the private key).

```bash

yarn run create-safe

```

## Safe Setup

This command sets up a Safe for Gnosis Pay by adding two modules: Delay and Roles.

```bash

yarn run setup-safe

```

## Sign Safe Message

This command handles Safe message signing in two steps:

```bash

yarn run sign-safe-message

```

1. **Message Signature Enqueueing:** This is done on the Delay module using the `execTransactionFromModule` method.

... ~3-minute cooldown ...

2. **Message Signature Execution:** This is done on the Delay module using the `executeNextTx` method.

You can update the message content you want to sign in the `sign-safe-message/index.ts` file.
