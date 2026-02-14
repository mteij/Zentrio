
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal, Button, Input } from '../../index'
import { apiFetch } from '../../../lib/apiFetch'
import styles from '../../../styles/Settings.module.css'

interface EmailVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  onSuccess: () => void
}

export const EmailVerificationModal = ({ isOpen, onClose, email, onSuccess }: EmailVerificationModalProps) => {
  const [otpCode, setOtpCode] = useState('')

  const handleVerifyEmail = async () => {
    try {
        const res = await apiFetch('/api/user/email/verify', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ newEmail: email, code: otpCode })
        })
        if (res.ok) {
            onSuccess()
            onClose()
            toast.success('Success', { description: 'Email updated successfully' })
        } else {
            toast.error('Verification Failed', { description: 'Invalid code' })
        }
    } catch (e) {
        console.error(e)
        toast.error('Network Error')
    }
  }

  return (
    <Modal id="otpModal" title="Verify Email" isOpen={isOpen} onClose={onClose}>
        <div className={styles.otpContainer}>
            <p>Enter the code sent to {email}</p>
            <Input 
                type="text" 
                value={otpCode} 
                onChange={(e) => setOtpCode(e.target.value)} 
                placeholder="Code" 
                className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                autoFocus
            />
            <Button variant="primary" onClick={handleVerifyEmail} style={{ marginTop: '10px' }}>Verify</Button>
        </div>
    </Modal>
  )
}
