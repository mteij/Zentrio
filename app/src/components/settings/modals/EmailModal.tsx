
import { useState } from 'react'
import { toast } from 'sonner'
import { MailCheck } from 'lucide-react'
import { ModalWithFooter, Button, FormGroup, Input } from '../../index'
import { apiFetch } from '../../../lib/apiFetch'

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (email: string) => void
}

export const EmailModal = ({ isOpen, onClose, onSuccess }: EmailModalProps) => {
  const [newEmail, setNewEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleInitiateEmailChange = async () => {
    setIsLoading(true)
    try {
        const res = await apiFetch('/api/user/email/initiate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ newEmail })
        })
        if (res.ok) {
            setIsSuccess(true)
            onSuccess(newEmail)
        } else {
            const data = await res.json().catch(() => ({}))
            toast.error('Email Change Failed', { description: data.message || 'Failed to initiate email change' })
        }
    } catch (e) {
        console.error(e)
        toast.error('Network Error')
    } finally {
        setIsLoading(false)
    }
  }

  const handleClose = () => {
    setNewEmail('')
    setIsSuccess(false)
    onClose()
  }

  if (isSuccess) {
    return (
      <ModalWithFooter
        id="emailModalSuccess"
        title="Check Your Email"
        isOpen={isOpen}
        onClose={handleClose}
        footer={
          <Button variant="primary" onClick={handleClose}>Got it</Button>
        }
      >
        <div className="text-center py-4">
          <div className="flex justify-center mb-4">
            <MailCheck className="w-16 h-16 text-red-500" />
          </div>
          <p className="text-zinc-300 mb-2">
            We&apos;ve sent a verification link to:
          </p>
          <p className="text-white font-semibold mb-4">{newEmail}</p>
          <p className="text-sm text-zinc-400">
            Click the link in the email to complete the change. The link will expire in 24 hours.
          </p>
        </div>
      </ModalWithFooter>
    )
  }

  return (
    <ModalWithFooter
        id="emailModal"
        title="Change Email"
        isOpen={isOpen}
        onClose={handleClose}
        footer={
            <>
                <Button variant="secondary" onClick={handleClose} disabled={isLoading}>Cancel</Button>
                <Button variant="primary" onClick={handleInitiateEmailChange} disabled={isLoading || !newEmail}>
                  {isLoading ? 'Sending...' : 'Continue'}
                </Button>
            </>
        }
    >
        <FormGroup label="New Email">
            <Input 
                type="email" 
                value={newEmail} 
                onChange={(e) => setNewEmail(e.target.value)} 
                className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                autoFocus
                disabled={isLoading}
            />
        </FormGroup>
    </ModalWithFooter>
  )
}
