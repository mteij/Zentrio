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
 * Displays an automation failure message and resets the automation stage.
 * This function centralizes the error handling for missing elements during automation steps.
 * @param {string} message - The specific error message for the failure modal.
 * @param {function(string): void} showAutomationFailModal - Callback to display the failure modal.
 * @returns {number} The stage to reset to (0 for restarting the automation).
 */
function handleAutomationFailure(message, showAutomationFailModal) {
    showAutomationFailModal(message);
    return 0; // Reset stage to 0 on failure
}

// --- Stremio Login Automation Logic ---
/**
 * Executes the Stremio login automation sequence within the iframe.
 * This function is designed to be called repeatedly on iframe load events,
 * progressing through stages until login is complete or an element is not found.
 * @param {Document} iframeDocument - The document object of the iframe.
 * @param {Object} profileData - The profile data containing email and password for login.
 * @param {number} currentStage - The current stage of the automation sequence (0-4).
 * @param {function(string, string): void} showNotification - A callback function to display notifications to the user.
 * @param {function(string): void} showAutomationFailModal - A callback function to display the automation failure modal.
 * @returns {Promise<number>} The next automation stage after execution.
 */
export async function executeStremioLoginAutomation(
    iframeDocument,
    profileData,
    currentStage,
    showNotification,
    showAutomationFailModal
) {
    let nextStage = currentStage;

    try {
        if (nextStage === 0) {
            // Stage 0: Initial load, click profile icon
            await delay(1500); // Initial delay for Stremio UI to settle

            const profileMenuButton = await waitForElement(
                iframeDocument,
                'div[class*="nav-menu-popup-label-"]' // Selector for the main profile icon
            );

            if (!profileMenuButton) {
                return handleAutomationFailure("Couldn't find the profile menu button (Stage 0).", showAutomationFailModal);
            }

            console.log("Stage 0: Profile menu button found, clicking it.");
            profileMenuButton.click();
            showNotification(
                "Profile menu opened, waiting for login/signup button...",
                "success"
            );
            nextStage = 1; // Advance stage
            // Proceed immediately to next stage as this is likely a popup on the same page, no iframe reload expected.
            return await executeStremioLoginAutomation(
                iframeDocument,
                profileData,
                nextStage,
                showNotification,
                showAutomationFailModal
            );

        } else if (nextStage === 1) {
            // Stage 1: Profile menu open, click "Log in / Sign up"
            await delay(1500); // Delay for popup content to render

            const loginSignupButton = await waitForElement(
                iframeDocument,
                'a[title="Log in / Sign up"]' // Selector for "Log in / Sign up" link
            );

            if (!loginSignupButton) {
                return handleAutomationFailure("Couldn't find the 'Log in / Sign up' button (Stage 1).", showAutomationFailModal);
            }

            console.log("Stage 1: Login / Sign up button found, clicking it.");
            loginSignupButton.click();
            showNotification(
                "Login/Sign up clicked, waiting for login page...",
                "success"
            );
            nextStage = 2; // Advance stage
            // This click is expected to cause a full page navigation in the iframe.
            // The next iframe.onload event will then trigger the automation for Stage 2.
            return nextStage;

        } else if (nextStage === 2) {
            // Stage 2: On the intermediate login page, click "Log in" button
            await delay(1500); // Wait for new page to render

            // Selector for the "Log in" button on the intermediate page
            const loginButtonOnPage = await waitForElement(
                iframeDocument,
                'div[class*="login-form-button-DqJUV"]' // Selector for the clickable button
            );

            if (!loginButtonOnPage) {
                return handleAutomationFailure("Couldn't find the intermediate 'Log in' button (Stage 2).", showAutomationFailModal);
            }

            console.log("Stage 2: 'Log in' button on intermediate page found, clicking it.");
            loginButtonOnPage.click();
            showNotification(
                "Intermediate login button clicked, waiting for form...",
                "success"
            );
            nextStage = 3; // Advance stage
            // Proceed immediately to the next stage as form appears on same page, no iframe reload expected.
            return await executeStremioLoginAutomation(
                iframeDocument,
                profileData,
                nextStage,
                showNotification,
                showAutomationFailModal
            );

        } else if (nextStage === 3) {
            // Stage 3: Login form visible, autofill and submit
            await delay(1500); // Wait for login form to appear

            const emailField = await waitForElement(
                iframeDocument,
                'input[placeholder="E-mail"]' // Selector for email input
            );
            const passwordField = await waitForElement(
                iframeDocument,
                'input[placeholder="Password"]' // Selector for password input
            );
            const finalLoginButton = await waitForElement(
                iframeDocument,
                'div[class*="submit-button-x3L8z"]' // Selector for the final submit button
            );

            if (!emailField || !passwordField || !finalLoginButton) {
                return handleAutomationFailure("Couldn't find email, password, or final login button (Stage 3).", showAutomationFailModal);
            }

            console.log("Stage 3: Login form elements found! Autofilling...");
            emailField.value = profileData.email;
            passwordField.value = profileData.password;

            // Dispatch input events to ensure Stremio's internal state updates
            emailField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('input', { bubbles: true })); // Fixed typo here

            console.log("Form filled. Attempting to click final login button.");
            finalLoginButton.click();
            showNotification("Automatic login attempted...", "success");
            nextStage = 4; // Advance stage
            // This click is expected to cause a full page navigation to the dashboard.
            // The next iframe.onload event will then trigger the automation for Stage 4.
            return nextStage;

        } else if (nextStage === 4) {
            // Stage 4: Post-login, open profile menu
            await delay(2000); // Give time for post-login redirects/UI to settle

            const profileMenuButtonAfterLogin = await waitForElement(
                iframeDocument,
                'div[class*="nav-menu-popup-label-"]' // Selector for the profile menu icon after login
            );

            if (!profileMenuButtonAfterLogin) {
                return handleAutomationFailure("Couldn't find profile menu button after login (Stage 4).", showAutomationFailModal);
            }

            console.log("Stage 4: Profile menu button found after login, clicking it.");
            profileMenuButtonAfterLogin.click();
            showNotification("Profile menu opened automatically!", "success");

            nextStage = 0; // Reset stage for next time, as automation is complete
            return nextStage;
        }
    } catch (error) {
        console.error("Error during automated login sequence:", error);
        return handleAutomationFailure("An unexpected error occurred during automation: " + error.message, showAutomationFailModal);
    }
    // This line should ideally not be reached if all stages explicitly return.
    return nextStage;
}
