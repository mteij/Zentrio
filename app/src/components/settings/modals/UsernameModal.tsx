
import { useState } from 'react'
import { toast } from 'sonner'
import { ModalWithFooter, Button, FormGroup, Input } from '../../index'
import { apiFetch } from '../../../lib/apiFetch'

interface UsernameModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const UsernameModal = ({ isOpen, onClose, onSuccess }: UsernameModalProps) => {
  const [newUsername, setNewUsername] = useState('')

  const handleUpdateUsername = async () => {
    try {
        const res = await apiFetch('/api/user/username', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ username: newUsername })
        })
        if (res.ok) {
            onSuccess()
            onClose()
            toast.success('Success', { description: 'Username updated' })
        } else {
            toast.error('Update Failed', { description: 'Failed to update username' })
        }
    } catch (e) {
        console.error(e)
        toast.error('Network Error')
    }
  }

  return (
    <ModalWithFooter
        id="usernameModal"
        title="Change Username"
        isOpen={isOpen}
        onClose={onClose}
        footer={
            <>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleUpdateUsername}>Update</Button>
            </>
        }
    >
        <FormGroup label="New Username">
            <Input 
                type="text" 
                value={newUsername} 
                onChange={(e) => setNewUsername(e.target.value)} 
                className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                autoFocus
            />
        </FormGroup>
    </ModalWithFooter>
  )
}
