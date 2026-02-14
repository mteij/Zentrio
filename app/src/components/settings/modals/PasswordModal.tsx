
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ModalWithFooter, Button, FormGroup, Input } from '../../index'
import { apiFetch } from '../../../lib/apiFetch'

interface PasswordModalProps {
  isOpen: boolean
  onClose: () => void
  hasPassword: boolean
  onSuccess: () => void
}

export const PasswordModal = ({ isOpen, onClose, hasPassword, onSuccess }: PasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (isOpen) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
    }
  }, [isOpen])

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
        toast.warning('Validation Error', { description: 'Passwords do not match' })
        return
    }
    try {
        const res = await apiFetch('/api/user/password', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ oldPassword: currentPassword, newPassword })
        })
        if (res.ok) {
            onSuccess()
            onClose()
            toast.success('Success', { description: 'Password updated successfully' })
        } else {
            toast.error('Update Failed', { description: 'Failed to update password' })
        }
    } catch (e) {
        console.error(e)
    }
  }

  const handleSetupPassword = async () => {
    if (newPassword !== confirmPassword) {
        toast.warning('Validation Error', { description: 'Passwords do not match' })
        return
    }
    if (newPassword.length < 8) {
        toast.warning('Validation Error', { description: 'Password must be at least 8 characters' })
        return
    }
    try {
        const res = await apiFetch('/api/user/password/setup', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ password: newPassword })
        })
        if (res.ok) {
            onSuccess()
            onClose()
            toast.success('Success', { description: 'Password set successfully' })
        } else {
            const data = await res.json().catch(() => ({}))
            toast.error('Setup Failed', { description: data.message || 'Failed to set password' })
        }
    } catch (e) {
        console.error(e)
        toast.error('Error', { description: 'Failed to set password' })
    }
  }

  return (
    <ModalWithFooter
        id="passwordModal"
        title={hasPassword ? "Change Password" : "Set Password"}
        isOpen={isOpen}
        onClose={onClose}
        footer={
            <>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={hasPassword ? handleUpdatePassword : handleSetupPassword}>
                  {hasPassword ? 'Update' : 'Set Password'}
                </Button>
            </>
        }
    >
        {hasPassword && (
          <FormGroup label="Current Password">
              <Input 
                  type="password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                  autoFocus
              />
          </FormGroup>
        )}
        <FormGroup label="New Password">
            <Input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder={hasPassword ? undefined : "At least 8 characters"}
                className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                autoFocus={!hasPassword}
            />
        </FormGroup>
        <FormGroup label="Confirm Password">
            <Input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
            />
        </FormGroup>
    </ModalWithFooter>
  )
}
