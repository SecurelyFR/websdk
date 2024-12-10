//
// Securely REST API wrapper
// This includes authentication with Securely's backend
//
// Copyright (c) 2024 Securely. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

/**
 * Development mode flag. Determines whether to use development or production endpoints.
 * @type {boolean}
 */
let devMode = document?.currentScript?.getAttribute('devmode') ?? false;

/**
 * Counter for generating unique request IDs.
 * @type {number}
 */
let requestIdCounter = 1;

/**
 * Sets the development mode.
 * @param {boolean} value - True to enable development mode, false to use production.
 */
function setDevMode(value) {
    devMode = value;
}

/**
 * Returns the base URL for Securely API.
 * @return {string} - The base URL based on the current mode.
 */
function getBaseUrl() {
    return (devMode) ? 'https://dev.securely.id' : 'https://prod.securely.id';
}

/**
 * Returns the authentication URL for Securely API.
 * @return {string} - The authentication URL based on the current mode.
 */
function getAuthUrl() {
    return (devMode) ? 'https://auth-dev.securely.id' : 'https://auth.securely.id';
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
 * @param {string} methodId - The method ID for authentication.
 * @return {Promise<Object>} - Resolves with API response.
 */
async function securelyCallAutoAuth(method, endpoint, params, methodId) {
    try {
        /* Detect if authentication is required */
        const providers = await getProviders(methodId);
        //console.log(providers);
        let token = null;
        for (const provider of providers.result) {
            if (provider.type.toLowerCase() === "auth" && provider.name.toLowerCase() === "webauthn") {
                /* Authentication required (WebauthN only for now) */
                const data = await securelyAuth(methodId);
                token = data.token;
                break;
            }
        }
        return await securelyCall(method, endpoint, params, token);
    } catch (error) {
        throw error;
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
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token != null) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        const requestOptions = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                'jsonrpc': '2.0',
                'method': method,
                'params': params,
                'id': getNextRequestId(),
            })
        };
        if (endpoint != null && endpoint.length !== 0) {
            endpoint = "/" + endpoint;
        }
        const response = await fetch(`${getBaseUrl()}/api/v0${endpoint}`, requestOptions);
        if (!response.ok) {
            throw new Error(response.error);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to perform Securely call %s:', method, error);
        throw error;
    }
}

/**
 * Fetches fee information from Securely API.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @return {Promise<Object>} - Resolves with fee data.
 */
function getFees(chainId, dappAddr) {
    return securelyCall('getFees', null, [chainId, dappAddr]);
}

/**
 * Calculates the gross amount including fees.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {number} amount - The initial amount in base units.
 * @return {Promise<Object>} - Resolves with the gross amount including fees.
 */
function getGrossAmount(chainId, dappAddr, amount) {
    return securelyCall('getGrossAmount', null, [chainId, dappAddr, amount.toString(16)]);
}

/**
 * Retrieves the list of authentication providers for a specific method.
 * @param {string} methodId - The method ID.
 * @return {Promise<Object>} - Resolves with the list of providers.
 */
function getProviders(methodId) {
    return securelyCall('getProviders', 'onboarding', { methodId: methodId });
}

/**
 * Computes a unique method ID based on the input parameters.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string|null} [functionSelector=null] - The function selector (optional).
 * @return {string} - The computed method ID.
 */
function computeMethodId(chainId, dappAddr, functionSelector = null) {
    return (functionSelector !== null)
        ? `${chainId}-${dappAddr.replace(/^0x/, '')}-${functionSelector.replace(/^0x/, '')}`
        : `${chainId}-${dappAddr.replace(/^0x/, '')}`;
}

/**
 * Validates compliance for a native transfer.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string} functionSelector - The function selector.
 * @param {string} srcAddr - The source address.
 * @param {string} destAddr - The destination address.
 * @param {number} amount - The transfer amount in base units.
 * @return {Promise<Object>} - Resolves with the compliance validation result.
 */
function validateEthTransferCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, amount) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendEthTransfer', chainId.toString(), [methodId, srcAddr, destAddr, amount, ""], methodId);
}

/**
 * Validates compliance for a native transfer with additional data.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string} functionSelector - The function selector.
 * @param {string} srcAddr - The source address.
 * @param {string} destAddr - The destination address.
 * @param {number} amount - The transfer amount in base units.
 * @param {string} data - Additional data for the transaction.
 * @return {Promise<Object>} - Resolves with the compliance validation result.
 */
function validateEthTransferWithDataCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, amount, data) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendEthTransfer', chainId.toString(), [methodId, srcAddr, destAddr, amount, data], methodId);
}

/**
 * Validates compliance for an ERC20 token transfer.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string} functionSelector - The function selector.
 * @param {string} srcAddr - The source address.
 * @param {string} destAddr - The destination address.
 * @param {string} tokenAddr - The token contract address.
 * @param {number} amount - The transfer amount in base units.
 * @return {Promise<Object>} - Resolves with the compliance validation result.
 */
function validateErc20TransferCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, tokenAddr, amount) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendErc20Transfer', chainId.toString(), [methodId, srcAddr, destAddr, tokenAddr, amount, ""], methodId);
}

/**
 * Validates compliance for an ERC20 token transfer with additional data.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string} functionSelector - The function selector.
 * @param {string} srcAddr - The source address.
 * @param {string} destAddr - The destination address.
 * @param {string} tokenAddr - The token contract address.
 * @param {number} amount - The transfer amount in base units.
 * @param {string} data - Additional data for the transaction.
 * @return {Promise<Object>} - Resolves with the compliance validation result.
 */
function validateErc20TransferWithDataCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, tokenAddr, amount, data) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendErc20Transfer', chainId.toString(), [methodId, srcAddr, destAddr, tokenAddr, amount, data], methodId);
}

/**
 * Validates compliance for a generic blockchain call.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @param {string} functionSelector - The function selector.
 * @param {string} srcAddr - The source address.
 * @param {number} amount - The amount in base units.
 * @param {string} data - Additional data for the call.
 * @return {Promise<Object>} - Resolves with the compliance validation result.
 */
function validateGenericCallCompliance(chainId, dappAddr, functionSelector, srcAddr, amount, data) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendGenericCall', chainId.toString(), [methodId, srcAddr, amount, data], methodId);
}

/**
 * Validates a user's compliance status.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @return {Promise<Object>} - Resolves with the user's compliance validation result.
 */
function validateUser(chainId, dappAddr) {
    const methodId = computeMethodId(chainId, dappAddr);
    return securelyCallAutoAuth('validateUser', chainId.toString(), [methodId], methodId);
}

/**
 * Fetches a specific policy by its ID.
 * @param {string} id - The policy ID.
 * @param {boolean} [formatted=true] - Whether to return the policy in a formatted structure.
 * @return {Promise<Object>} - Resolves with the policy data.
 */
function showPolicyById(id, formatted = true) {
    return securelyCall('showPolicy', '', { id: id, formatted: formatted });
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
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return showPolicyById(methodId, formatted);
}

/**
 * Lists all policies for a given chain ID and dApp address.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @return {Promise<Object>} - Resolves with the list of policies.
 */
function listPolicies(chainId, dappAddr) {
    return securelyCall('listPolicies', '', { chainId: chainId, dappAddr: dappAddr });
}

/**
 * Checks if a smart contract is protected by any policies.
 * @param {number} chainId - The blockchain chain ID.
 * @param {string} dappAddr - The dApp address.
 * @return {Promise<boolean>} - Resolves with true if protected, false otherwise.
 */
async function isSCProtected(chainId, dappAddr) {
    const res = await securelyCall('listPolicies', '', { chainId: chainId, dappAddr: dappAddr });
    return res.result.length !== 0;
}

// Export the functions for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setDevMode,
        securelyCallAutoAuth,
        securelyCall,
        getProviders,
        validateEthTransferCompliance,
        validateEthTransferWithDataCompliance,
        validateErc20TransferCompliance,
        validateErc20TransferWithDataCompliance,
        validateGenericCallCompliance,
        validateUser,
        showPolicyById,
        showPolicy,
        listPolicies,
        isSCProtected,
    };
}
