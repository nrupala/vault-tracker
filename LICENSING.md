# Licensing — vault-tracker

Zero trust self-contained, offline, vault based expense tracker (ledger), habit tracker, notes engine, and tasklist with reminder notification.

## Owner-directed model

This repository is a commercial product of **2351485 ALBERTA INC.** It uses the portfolio’s split-licence model:

- **Proprietary core** — all rights reserved; no patent licence is granted.
- **Apache License 2.0 interface** — the Apache §3 patent grant applies only to the interface components identified below.

The controlling texts are in `LICENSES/`. `LICENSE` is a pointer to this map. Official packaged-product use is also governed by `TERMS.md`.

Copies already distributed under a prior licence remain governed by that licence for those copies. This map governs the repository and future distributions from the point this change is adopted.

## Proprietary core

Unless a file, directory, or component is expressly identified as interface material or as a third-party component, it is part of the proprietary core. The core includes, as applicable:

- application, service, engine, and business logic;
- data models, persistence, synchronization, and internal workflows;
- cryptography, security controls, vault or key handling, and recovery logic;
- agent-authorization and audit internals;
- back-end services and non-public operational logic; and
- algorithms, specifications, and implementation know-how not expressly placed in the interface layer.

The core is licensed under `LICENSES/Proprietary.txt`. Copyright is held by **2351485 ALBERTA INC.** No licence is granted under copyright, patent, trademark, trade secret, or any other right except as expressly stated in a separate written agreement or the applicable product terms.

## Apache 2.0 interface

The interface layer consists only of components whose purpose is external interoperability and that are identified by this map, a directory notice, or an SPDX header as Apache-2.0. As applicable, it includes:

- public user-interface or command-line presentation shells;
- public API schemas, client libraries, and integration adapters;
- documented import, export, and interchange format definitions;
- examples and interoperability documentation; and
- platform packaging or scaffolding intended for external integration.

The interface is licensed under `LICENSES/Apache-2.0.txt`. Apache §3 grants the stated patent licence for that interface layer, including its retaliation provision. It does **not** extend a patent licence to the proprietary core.

If a component’s classification is ambiguous, treat it as proprietary core until the owner records a different classification here.

## Patents

- **Interface:** Apache License 2.0 §3 applies in full to the interface layer.
- **Core:** **No patent licence is granted, expressly or by implication. All patent rights are expressly reserved by 2351485 ALBERTA INC.**
- Inspection or availability of source code is not a patent licence.

## Product terms

The standard product terms in `TERMS.md` apply to official packaged or distributed product supplies. They include the owner-directed liability cap, excluded damages, user-environment responsibility, no absolute security guarantee, consumer-law preservation, severability, and Calgary, Alberta venue provisions.

## Third-party material

Third-party components retain their own copyright and licence terms. A third-party licence does not reclassify the surrounding proprietary core or interface material.

## Access model — documentation only

Where `vault-tracker` is supplied as a runnable product, its supported access modes are documented and governed according to need:

- **Human access:** the product’s user interface or other human-facing surface.
- **Machine access:** documented command-line, automation, or system-integration surfaces.
- **Agent access:** access by an authorized software agent, only where the product implements it.
- **Software access:** documented embedding, plug-in, library, or integration surfaces.
- **API access:** a documented programmatic interface, where provided.

Agent authorization, where implemented, uses a key-value record keyed by agent ID. The value contains only a hashed agent token, permitted scopes, expiry, and an enabled/disabled state. A human administrator enrolls, narrows, disables, or revokes an agent; the agent does not receive the human’s master credential. Agent activity is recorded in a tamper-evident, hash-chained audit log where the product provides one.

This section describes the portfolio access standard. It does not claim that every access mode is implemented in the current release.

