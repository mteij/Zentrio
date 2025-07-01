// public/iframe-automations/loginAutomation.js

// --- Utility Functions for Automation ---
/**
 * Pauses execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for an HTML element to appear in the DOM of a given document.
 * It polls for the element using the provided selector at a specified interval
 * for a maximum number of retries.
 * @param {Document} doc - The document object (e.g., iframeDocument).
 * @param {string} selector - The CSS selector for the element to wait for.
 * @param {number} [interval=500] - The time in milliseconds between each retry attempt.
 * @param {number} [retries=10] - The maximum number of times to retry finding the element.
 * (Default 10 retries * 500ms interval = 5 seconds max wait).
 * @returns {Promise<Element|null>} A promise that resolves with the found element, or null if not found after retries.
 */
async function waitForElement(doc, selector, interval = 500, retries = 10) {
    let element = null;
    for (let i = 0; i < retries; i++) {
        element = doc.querySelector(selector);
        if (element) {
            return element;
        }
        await delay(interval);
    }
    return null; // Return null if element is not found after all retries
}

/**
 * Displays an automation failure message and indicates the failure.
 * This function centralizes the error handling for missing elements during automation steps.
 * @param {string} message - The specific error message for the failure modal.
 * @param {function(string): void} showAutomationFailModal - Callback to display the failure modal.
 * @returns {boolean} Returns false to indicate automation failure.
 */
function handleAutomationFailure(message, showAutomationFailModal) {
    showAutomationFailModal(message);
    return false; // Indicate failure
}

// --- Streamlined Stremio Login Automation Logic ---
/**
 * Attempts to perform the Stremio login sequence within the iframe.
 * This function assumes the iframe content is at the login form stage or can reach it quickly.
 * @param {Document} iframeDocument - The document object of the iframe.
 * @param {Object} profileData - The profile data containing email and password for login.
 * @param {function(string, string): void} showNotification - A callback function to display notifications to the user.
 * @param {function(string): void} showAutomationFailModal - A callback function to display the automation failure modal.
 * @returns {Promise<boolean>} A promise that resolves to true if login elements are found and processed, false otherwise.
 */
export async function performStreamlinedLoginAutomation(
    iframeDocument,
    profileData,
    showNotification,
    showAutomationFailModal
) {
    try {
        await delay(2000); // Initial delay to ensure page loads

        const emailField = await waitForElement(iframeDocument, 'input[placeholder="E-mail"]');
        const passwordField = await waitForElement(iframeDocument, 'input[placeholder="Password"]');
        const finalLoginButton = await waitForElement(iframeDocument, 'div[class*="submit-button-x3L8z"]');

        if (!emailField || !passwordField || !finalLoginButton) {
            return handleAutomationFailure("Couldn't find email, password, or final login button to perform streamlined login.", showAutomationFailModal);
        }

        console.log("Streamlined Login: Filling form and clicking login.");
        emailField.value = profileData.email;
        passwordField.value = profileData.password;

        // Dispatch input events to ensure Stremio's internal state updates
        emailField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));

        finalLoginButton.click();
        showNotification("Automatic login attempted...", "success");
        return true; // Automation initiated
    } catch (error) {
        console.error("Error during streamlined login automation:", error);
        return handleAutomationFailure("An unexpected error occurred during streamlined automation: " + error.message, showAutomationFailModal);
    }
}