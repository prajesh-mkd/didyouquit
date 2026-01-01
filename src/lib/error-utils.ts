export const getFriendlyErrorMessage = (error: any): string | null => {
    // Log the full error for debugging
    console.error("Operation Error:", error);

    const code = error?.code;
    const msg = error?.message;

    if (!code) {
        // If it's a string, return it, otherwise default
        if (typeof error === 'string') return error;
        return msg || "An unexpected error occurred.";
    }

    switch (code) {
        case "auth/popup-closed-by-user":
            return null; // Ignore this error
        case "auth/email-already-in-use":
            return "That email is already registered. Try logging in.";
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/user-not-found":
            return "Invalid email or password.";
        case "auth/weak-password":
            return "Password should be at least 6 characters.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/requires-recent-login":
            return "For security, please log out and log back in to perform this action.";
        case "permission-denied":
            return "You don't have permission to perform this action.";
        case "unavailable":
            return "Service temporarily unavailable. Please check your internet connection.";
        default:
            return "Something went wrong. Please try again.";
    }
};
