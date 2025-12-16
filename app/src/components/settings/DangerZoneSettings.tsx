import { useState } from 'react'
import { toast } from 'sonner'
import { Button, InputDialog, ConfirmDialog } from '../index'
import styles from '../../styles/Settings.module.css'

export function DangerZoneSettings() {
  const [showTypeDelete, setShowTypeDelete] = useState(false)
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const handleDeleteRequest = () => {
    setShowTypeDelete(true)
  }

  const handleTypeDeleteSubmit = (value: string) => {
    setDeleteConfirmation(value)
    if (value === 'DELETE') {
      setShowFinalConfirm(true)
    } else {
      toast.warning('Invalid Input', { description: 'Please type "DELETE" exactly to confirm' })
    }
  }

  const handleDeleteAccount = async () => {
            try {
                const res = await fetch('/api/user/account', {
                    method: 'DELETE',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                if (res.ok) {
                    toast.success('Request Sent', { description: 'Account deletion initiated. You will receive a confirmation email.' })
                    window.location.href = '/'
                } else {
                    toast.error('Deletion Failed', { description: 'Failed to initiate account deletion' })
                }
            } catch (e) {
                console.error(e)
                toast.error('Network Error', { description: 'Network error' })
            }
  }

  return (
    <div className={styles.tabContent}>
      <div className={`${styles.settingsCard} border-red-500/30`}>
        <h2 className={`${styles.sectionTitle} text-red-500`}>Danger Zone</h2>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">Delete Account</h3>
                <p className="text-sm text-zinc-400">Permanently delete your account and all associated data. This action cannot be undone.</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <Button variant="danger" onClick={handleDeleteRequest}>
                    Delete Account
                </Button>
            </div>
        </div>
      </div>

      {/* Type DELETE Confirmation */}
      <InputDialog
        isOpen={showTypeDelete}
        onClose={() => setShowTypeDelete(false)}
        onSubmit={handleTypeDeleteSubmit}
        title="Confirm Account Deletion"
        message='Type "DELETE" to confirm account deletion:'
        placeholder="DELETE"
        confirmText="Continue"
        cancelText="Cancel"
        validation={(value) => {
          if (value !== 'DELETE') return 'Please type DELETE exactly';
          return null;
        }}
      />

      {/* Final Confirmation */}
      <ConfirmDialog
        isOpen={showFinalConfirm}
        onClose={() => {
          setShowFinalConfirm(false);
          setDeleteConfirmation('');
        }}
        onConfirm={handleDeleteAccount}
        title="Are You Absolutely Sure?"
        message="This action cannot be undone. All your data will be permanently deleted."
        confirmText="Delete My Account"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}