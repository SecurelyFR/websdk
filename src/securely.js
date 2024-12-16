//
// Securely REST API wrapper
// This includes authentication with Securely's backend
//
// Copyright (c) 2024 Securely. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

/**
 * The backend subdomain to use. Determines whether to use local, development or production endpoints.
 * @type {string}
 */
let backend = document?.currentScript?.getAttribute('devmode') ? 'dev' : 'prod';

/**
 * The backend TCP port to use. Needs to be overriden when using a local backend
 * @type {number}
 */
let backendPort = 443;

/**
 * Counter for generating unique request IDs.
 * @type {number}
 */
let requestIdCounter = 1;

/**
 * Sets the development mode.
 * @param {string} subdomain - 'local' to use local, 'dev' to use dev, 'prod' tu use prod
 * @param {number} [port=443] - the TCP port tu use (optional)
 */
function setBackend(subdomain, port=443) {
    backend = subdomain;
    backendPort = port;
}

/**
 * Returns the base URL for Securely API.
 * @return {string} - The base URL based on the current mode.
 */
function getBaseUrl() {
    return `http${backendPort == 443 ? 's' : ''}://${backend}.securely.id${backendPort == 443 || backendPort == 80 ? '' : `:${backendPort}`}`;
}

/**
 * Returns the authentication URL for Securely API.
 * @return {string} - The authentication URL based on the current mode.
 */
function getAuthUrl() {
    const auth = `auth-${backend}`.replace(/-$/, '')
    return `http${backendPort == 443 ? 's' : ''}://${auth}.securely.id${backendPort == 443 || backendPort == 80 ? '' : `:${backendPort}`}`;
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
    return new Promise((resolve) => {
        if (useIframe) {
            const overlay = document.createElement('div');
            const iframe = document.createElement('iframe');

            const style = document.createElement('style');
            style.textContent = `
              .auth-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 1000;
                display: flex;
                justify-content: center;
                align-items: center;
              }

              .auth-iframe {
                border: none;
                border-radius: 15px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                z-index: 1001;
                width: 700px;
                height: 1000px;
              }

              /* No box for small screens */
              @media (max-width: 700px), (max-height: 1000px) {
                .auth-iframe {
                  width: 100vw;
                  height: 100vh;
                  border-radius: 0;
                }
              }
            `;

            document.head.appendChild(style);

            overlay.className = 'auth-overlay';
            iframe.className = 'auth-iframe';

            iframe.src = `${getAuthUrl()}?methodId=${methodId}`;
            iframe.sandbox = "allow-scripts allow-same-origin allow-forms";

            /* Allow Webauthn within iframe */
            iframe.allow = "publickey-credentials-get; publickey-credentials-create";

            overlay.appendChild(iframe);
            document.body.appendChild(overlay);

            iframe.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        } else {
            const newWindow = window.open(`${getAuthUrl()}?methodId=${methodId}`,
                "Securely Authentication",
                "toolbar=no,scrollbars=no,location=no,statusbar=no,menubar=no,resizable=0,width=700,height=1000");
            newWindow.focus();
        }

        function messageHandler(event) {
            if (event.origin === getAuthUrl()) {
                window.removeEventListener('message', messageHandler);

                if (useIframe) {
                    const overlay = document.querySelector('.auth-overlay');
                    document.body.removeChild(overlay);
                }

                const receivedData = event.data;
                console.log('Received data from Securely Auth:', receivedData);

                resolve(receivedData);
            }
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
async function securelyCallAutoAuth(method, endpoint, params, chainId, dAppAddress, functionSelector='') {
    const methodId = computeMethodId(chainId, dAppAddress, functionSelector);
    // Will call securelyAuth if authentication is required. Only webauthn is supported for now
    return await securelyCall(
        method,
        endpoint,
        params,
        (await getProviders(methodId)).result.filter(
            p => p.type.toLowerCase() === "auth" && p.name.toLowerCase() === "webauthn"
        ).length !== 0 ? (await securelyAuth(methodId)).token : null
    );
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

    const resource = `${getBaseUrl()}/api/v0/${endpoint}`.replace(/\/$/, '');
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
    return `${chainId}-${dAppAddress.replace(/^0x/, '')}-${functionSelector.replace(/^0x/, '')}`.replace(/-$/, '');
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
        setBackend,
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
