// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: MIT

const { contextBridge } = require('electron');

// Branded bridge for potential future native features (e.g. system notifications)
contextBridge.exposeInMainWorld('vaultDesktop', {
  platform: process.platform,
  version: '2.1.0'
});
