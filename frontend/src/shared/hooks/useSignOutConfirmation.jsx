import { useCallback, useState } from 'react';
import { useAuth } from '@core/context/AuthContext';
import SignOutConfirmDialog from '../components/SignOutConfirmDialog';

export function useSignOutConfirmation() {
    const { logout } = useAuth();
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const requestSignOut = useCallback(() => {
        setOpen(true);
    }, []);

    const confirmSignOut = useCallback(async () => {
        setIsLoading(true);
        try {
            await logout();
            setOpen(false);
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    const signOutDialog = (
        <SignOutConfirmDialog
            open={open}
            onOpenChange={setOpen}
            onConfirm={confirmSignOut}
            isLoading={isLoading}
        />
    );

    return { requestSignOut, signOutDialog };
}
