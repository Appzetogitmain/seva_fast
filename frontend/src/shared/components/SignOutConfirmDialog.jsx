import React from 'react';
import { LogOut } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export default function SignOutConfirmDialog({ open, onOpenChange, onConfirm, isLoading = false }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <LogOut className="h-4 w-4" />
                        </span>
                        Sign out?
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Are you sure you want to sign out of your account?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                    >
                        {isLoading ? 'Signing out...' : 'Sign Out'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
