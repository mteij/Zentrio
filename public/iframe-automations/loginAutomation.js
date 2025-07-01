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
 * Simulates typing text into an input field character by character.
 * @param {HTMLInputElement} element - The input element.
 * @param {string} text - The text to type.
 * @param {number} delayMs - Delay in milliseconds between each character.
 */
async function typeCharacterByCharacter(element, text, delayMs) {
    element.value = ''; // Ensure it's clear before typing
    for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(delayMs);
    }
    // Dispatch change and blur events after all characters are typed
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}


// --- Streamlined Stremio Login Automation Logic ---
/**
 * Attempts to perform the Stremio login sequence within the iframe.
 * This function assumes the iframe content is at the login form stage or can reach it quickly.
 * @param {Document} iframeDocument - The document object of the iframe.
 * @param {Object} profileData - The profile data containing email and password for login.
 * @param {function(string, string): void} showNotification - A callback function to display notifications to the user.
 * @returns {Promise<boolean>} A promise that resolves to true if login elements are found and processed, false otherwise.
 */
export async function performStreamlinedLoginAutomation(
    iframeDocument,
    profileData,
    showNotification
) {
    try {
        await delay(3000); // Initial delay for page to settle

        const emailField = await waitForElement(iframeDocument, 'input[placeholder="E-mail"]');
        const passwordField = await waitForElement(iframeDocument, 'input[placeholder="Password"]');
        const finalLoginButton = await waitForElement(iframeDocument, 'div[class*="submit-button-x3L8z"]');

        if (!emailField || !passwordField || !finalLoginButton) {
            console.error("Automation failed: Could not find one or more login elements.");
            showNotification('Automated login failed: Could not find login elements.', 'error');
            return false;
        }

        console.log("Streamlined Login: Simulating typing and clicking login.");

        // Simulate typing for email field
        emailField.focus();
        await typeCharacterByCharacter(emailField, profileData.email.trim(), 50); // 50ms delay per character

        // Simulate typing for password field
        passwordField.focus();
        await typeCharacterByCharacter(passwordField, profileData.password.trim(), 50); // 50ms delay per character

        await delay(500); // Small delay after filling fields before clicking

        finalLoginButton.click();
        showNotification("Automatic login attempted...", "success");
        return true; // Automation initiated
    } catch (error) {
        console.error("Error during streamlined login automation:", error);
        showNotification('An unexpected error occurred during automated login: ' + error.message, 'error');
        return false;
    }
}