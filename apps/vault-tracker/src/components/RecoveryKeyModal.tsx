import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Copy, Check, Download, AlertTriangle, Printer } from 'lucide-react';
import { useVault } from '../lib/core/useVault';

interface RecoveryKeyModalProps {
  /**
   * Optional hook to download the encrypted backup. Wired by the parent that
   * owns the unlocked vault (useItems.exportEncryptedBackup). When omitted, the
   * backup section is hidden. Receives the user-chosen backup passphrase.
   */
  onDownloadBackup?: (passphrase: string) => Promise<void>;
}

/**
 * Self-contained. Renders only when useVault() has a pending recovery key
 * (right after vault creation or a legacy->DEK migration). Mount it once
 * anywhere inside <VaultProvider>:  <RecoveryKeyModal onDownloadBackup={...} />
 */
export function RecoveryKeyModal({ onDownloadBackup }: RecoveryKeyModalProps) {
  const { pendingRecoveryKey, pendingRecoveryReason, acknowledgeRecoveryKey } = useVault();

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = pendingRecoveryKey !== null;

  const handleCopy = async () => {
    if (!pendingRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(pendingRecoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically — please select and copy the key manually.');
    }
  };

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!onDownloadBackup) return;
    if (passphrase.length < 8) {
      setError('Backup passphrase must be at least 8 characters.');
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      await onDownloadBackup(passphrase);
      setBackupDone(true);
      setPassphrase('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleContinue = () => {
    if (!saved) return;
    acknowledgeRecoveryKey();
    // reset local state for any future invocation
    setSaved(false);
    setCopied(false);
    setBackupDone(false);
    setError(null);
  };

  const title =
    pendingRecoveryReason === 'migrated'
      ? 'Your vault was upgraded — save your recovery key'
      : 'Save your recovery key';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl shrink-0 bg-primary/10">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This key is the only way to regain access if you forget your password. Your
                  data is end-to-end encrypted, so no one — including us — can recover it for you.
                  Store it somewhere safe and offline.
                </p>
              </div>
            </div>

            {/* Recovery key */}
            <div className="rounded-xl bg-secondary p-3 space-y-3">
              <code className="block font-mono text-sm break-all select-all leading-relaxed text-foreground">
                {pendingRecoveryKey}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-card border border-border hover:bg-secondary/60 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-card border border-border hover:bg-secondary/60 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>

            {/* Optional encrypted backup */}
            {onDownloadBackup && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-sm font-semibold">Download an encrypted backup (recommended)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A portable, encrypted copy of your vault. Choose a passphrase you'll remember —
                  you'll need it (or your recovery key) to restore on a new device.
                </p>
                {backupDone ? (
                  <div className="flex items-center gap-2 text-sm text-primary font-semibold">
                    <Check className="w-4 h-4" /> Backup downloaded
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
                      placeholder="Backup passphrase"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-card border border-border hover:bg-secondary/60 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {downloading ? 'Saving…' : 'Download'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Acknowledge */}
            <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaved(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I've saved my recovery key somewhere safe. I understand it cannot be recovered if lost.
              </span>
            </label>

            <button
              onClick={handleContinue}
              disabled={!saved}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
