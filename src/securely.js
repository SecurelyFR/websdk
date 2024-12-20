//
// Securely REST API wrapper
// This includes authentication with Securely's backend
//
// Copyright (c) 2024 Securely. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

/**
 * The backend URL to use. Determines whether to use local, development or production endpoints.
 * @type {string}
 */
let backendUrl = 'https://prod.securely.id';

/**
 * The auth URL to use. Determines whether to use local, development or production endpoints.
 * @type {string}
 */
let authUrl = 'https://auth.securely.id';

/**
 * Counter for generating unique request IDs.
 * @type {number}
 */
let requestIdCounter = 1;

/**
 * Sets the backend URL.
 * @param {string} url - The backend URL to use.
 */
function setBackendUrl(url) {
    backendUrl = url;
}

/**
 * Sets the auth URL.
 * @param {string} url - The auth URL to use.
 */
function setAuthUrl(url) {
    authUrl = url;
}

/**
 * Sets the backend URL to use the dev environment.
 * This is a convenience function for testing.
 * Note: This function should not be used in production.
 */
function setDevMode() {
    backendUrl = 'https://dev.securely.id';
    authUrl = 'https://auth-dev.securely.id';
}

/**
 * Generates the next unique request ID.
 * @return {number} - The next request ID.
 */
function getNextRequestId() {
    return requestIdCounter++;
}

/**
 * Initiates Securely authentication flow.
 * @param {string} methodId - The method ID for the authentication.
 * @param {boolean} [useIframe=true] - Whether to use an iframe or a new window for the flow.
 * @return {Promise<Object>} - Resolves with authentication data.
 */
function securelyAuth(methodId, useIframe = true) {
    return new Promise((resolve, reject) => {
        if (useIframe) {
            const overlay = document.createElement('div');
            const container = document.createElement('div');
            const iframe = document.createElement('iframe');
            const closeButton = document.createElement('button');

            const style = document.createElement('style');
            style.textContent = `
              .auth-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 2000;
                display: flex;
                justify-content: center;
                align-items: center;
              }

              .auth-container {
                position: relative;
                border-radius: 20px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                z-index: 2001;
                width: 700px;
                height: 1000px;
              }

              .auth-iframe {
                border: none;
                box-sizing: border-box;
                width: 700px;
                height: 1000px;
              }

              /* No box for small screens */
              @media (max-width: 700px), (max-height: 1000px) {
                .auth-iframe {
                  width: 100vw;
                  height: 100vh;
                }
                .auth-container {
                  width: 100vw;
                  height: 100vh;
                  border-radius: 0;
                }
              }

              .auth-close-button {
                position: absolute;
                top: 10px;
                right: 10px;
                color: grey;
                border: none;
                background: none;
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
                z-index: 2002;
                padding: 0;
                outline: none;
              }

              .auth-close-button:hover {
                color: black;
                background: none;
              }

              .auth-close-button:focus {
                outline: none;
              }
            `;

            document.head.appendChild(style);

            overlay.className = 'auth-overlay';
            container.className = 'auth-container';
            iframe.className = 'auth-iframe';
            closeButton.className = 'auth-close-button';
            closeButton.innerHTML = '&times;'; // X symbol for the button

            iframe.src = `${authUrl}?methodId=${methodId}`;
            iframe.sandbox = "allow-scripts allow-same-origin allow-forms";

            /* Allow Webauthn within iframe */
            iframe.allow = "publickey-credentials-get; publickey-credentials-create";

            container.appendChild(iframe);
            container.appendChild(closeButton);
            overlay.appendChild(container);
            document.body.appendChild(overlay);

            closeButton.addEventListener('click', () => {
                document.body.removeChild(overlay);
                reject(new Error('Authentication canceled by user.'));
            });

            iframe.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        } else {
            const newWindow = window.open(`${authUrl}?methodId=${methodId}`,
                "Securely Authentication",
                "toolbar=no,scrollbars=no,location=no,statusbar=no,menubar=no,resizable=0,width=700,height=1000");
            newWindow.focus();
        }

        function messageHandler(event) {
            if (event.origin !== authUrl) {
                return;
            }

            const receivedData = event.data;
            console.log('Received data from Securely Auth:', receivedData);

            // Verify if the message is the one expected
            if (!receivedData || typeof receivedData.token !== 'string') {
                return;
            }

            window.removeEventListener('message', messageHandler);

            if (useIframe) {
                const overlay = document.querySelector('.auth-overlay');
                document.body.removeChild(overlay);
            }

            resolve(receivedData.token);
       }

        window.addEventListener('message', messageHandler);
    });
}

/**
 * Calls Securely API with automatic authentication.
 * @param {string} method - The API method name.
 * @param {string} endpoint - The API endpoint.
 * @param {Array|Object} params - Parameters for the API call.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dAppAddress - The dApp address.
 * @param {string} [functionSelector=''] - The function selector (optional).
 * @return {Promise<Object>} - Resolves with API response.
 */
async function securelyCallAutoAuth(method, endpoint, params, chainId, dAppAddress, functionSelector = '') {
    const methodId = computeMethodId(chainId, dAppAddress, functionSelector);

    try {
        // Get providers and check if authentication is required
        const providers = await getProviders(methodId);
        const requiresAuth = providers.result.some(
            // Only webauthn is supported for now
            p => p.type.toLowerCase() === "auth" && p.name.toLowerCase() === "webauthn"
        );

        let token = null;
        if (requiresAuth) {
            try {
                token = await securelyAuth(methodId);
            } catch (authError) {
                console.error(`Authentication error: ${authError.message}`);
                throw new Error("Authentication failed. Please try again.");
            }
        }

        // Make the actual API call
        return await securelyCall(method, endpoint, params, token);
    } catch (error) {
        console.error(`Error in securelyCallAutoAuth: ${error.message}`);
        throw error; // Re-throw the error to propagate it to the caller
    }
}

/**
 * Makes a POST request to Securely API.
 * @param {string} method - The API method name.
 * @param {string} endpoint - The API endpoint.
 * @param {Array|Object} params - Parameters for the API call.
 * @param {string} [token] - Optional authentication token.
 * @return {Promise<Object>} - Resolves with API response.
 */
async function securelyCall(method, endpoint, params, token) {
    function deepConvertBigIntToString(obj) {
        if (typeof obj === 'bigint')
            return obj.toString();
        if (Array.isArray(obj))
            return obj.map(deepConvertBigIntToString);
        if (obj !== null && typeof obj === 'object')
            return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepConvertBigIntToString(v)]));
        return obj;
    }

    const resource = `${backendUrl}/api/v0/${endpoint}`.replace(/\/$/, '');
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(deepConvertBigIntToString({
            'jsonrpc': '2.0',
            'method': method,
            'params': params,
            'id': getNextRequestId(),
        }))
    };
    try {
        const response = await fetch(resource, options);
        if (!response.ok)
            throw new Error(response.error);
        return await response.json();
    } catch (error) {
        console.error('Failed to perform Securely call %s:', method, error);
        throw error;
    }
}

/**
 * Retrieves the list of authentication providers for a specific method.
 * @param {string} methodId - The method ID.
 * @return {Promise<Object>} - Resolves with the list of providers.
 */
function getProviders(methodId) {
    return securelyCall('getProviders', 'onboarding', { methodId });
}

/**
 * Computes a unique method ID based on the input parameters.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dAppAddress - The dApp address.
 * @param {string} [functionSelector=''] - The function selector (optional).
 * @return {string} - The computed method ID.
 */
function computeMethodId(chainId, dAppAddress, functionSelector = '') {
    dAppAddress = dAppAddress.replace(/^0x/, '');
    functionSelector = functionSelector.replace(/^0x/, '');
    return `${chainId}-${dAppAddress}-${functionSelector}`.replace(/-$/, '').toLowerCase();
}

/**
 * Validates compliance for any transaction. Specify either functionSelector and args, or data.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} sender - The sender address.
 * @param {string} dAppAddress - The dApp address.
 * @param {number} value - The transaction value in base units.
 * @param {Object|string} data - Either the tx data or the function selector and parameters.
 * @param {List<Tuple<string, number>>} policyParameters.amounts - An array of (token, value) tuples for the policy
 * @param {List<string>} policyParameters.wallets - An array of wallet addresses for the policy
 * @return {Promise<Object>} - Resolves with the compliance validation result.
 */
function validateCompliance(chainId, sender, dAppAddress, value, data, policyParameters) {
    const dataIsEncoded = typeof data === 'string' || data instanceof String;
    const functionSelector = dataIsEncoded ? data.replace(/^0x/, '').slice(0, 8) : data.functionSelector;
    const params = dataIsEncoded ?
        {chainId, sender, dAppAddress, value, data, policyParameters}
        : {chainId, sender, dAppAddress, value, functionSelector, args: data.args, policyParameters};
    return securelyCallAutoAuth('validate', chainId, params, chainId, dAppAddress, functionSelector);
}

/**
 * Validates a user's compliance status.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dAppAddress - The dApp address.
 * @return {Promise<Object>} - Resolves with the user's compliance validation result.
 */
function validateUser(chainId, dAppAddress) {
    return securelyCallAutoAuth('validate', `${chainId}`, { chainId, dAppAddress }, chainId, dAppAddress);
}

/**
 * Fetches a specific policy by its ID.
 * @param {string} id - The policy ID.
 * @param {boolean} [formatted=true] - Whether to return the policy in a formatted structure.
 * @return {Promise<Object>} - Resolves with the policy data.
 */
function showPolicyById(id, formatted = true) {
    return securelyCall('showPolicy', '', { id, formatted });
}

/**
 * Fetches a policy based on chain ID, dApp address, and function selector.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string} functionSelector - The function selector.
 * @param {boolean} [formatted=true] - Whether to return the policy in a formatted structure.
 * @return {Promise<Object>} - Resolves with the policy data.
 */
function showPolicy(chainId, dappAddr, functionSelector, formatted = true) {
    return showPolicyById(computeMethodId(chainId, dappAddr, functionSelector), formatted);
}

/**
 * Lists all policies for a given chain ID and dApp address.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @return {Promise<Object>} - Resolves with the list of policies.
 */
function listPolicies(chainId, dappAddr) {
    return securelyCall('listPolicies', '', { chainId, dappAddr });
}

/**
 * Checks if a smart contract is protected by any policies.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @return {Promise<boolean>} - Resolves with true if protected, false otherwise.
 */
async function isSCProtected(chainId, dappAddr) {
    return (await securelyCall('listPolicies', '', { chainId, dappAddr })).result.length !== 0;
}

// Export the functions for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setBackendUrl,
        setAuthUrl,
        setDevMode,
        securelyCallAutoAuth,
        securelyCall,
        getProviders,
        validateCompliance,
        validateUser,
        showPolicyById,
        showPolicy,
        listPolicies,
        isSCProtected,
    };
}
