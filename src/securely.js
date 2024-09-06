//
// Securely REST API wrapper
// This includes authentication with Securely's backend
//
// Copyright (c) 2024 Securely. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

let devMode = document?.currentScript?.getAttribute('devmode') ?? false;

let requestIdCounter = 1;

function setDevMode(value) {
    devMode = value;
}

function getBaseUrl() {
    return (devMode) ? 'https://dev.securely.id' : 'https://prod.securely.id';
}

function getAuthUrl() {
    return (devMode) ? 'https://auth-dev.securely.id' : 'https://auth.securely.id';
}

function getNextRequestId() {
    return requestIdCounter++;
}

function securelyAuth(methodId) {
    return new Promise((resolve) => {
        const newWindow = window.open(`${getAuthUrl()}?methodId=${methodId}`,"Securely Authentication", "toolbar=no,scrollbars=no,location=no,statusbar=no,menubar=no,resizable=0,width=700,height=1000");
        newWindow.focus();

        function messageHandler(event) {
            if (event.origin === getAuthUrl()) {
                window.removeEventListener('message', messageHandler);

                const receivedData = event.data;
                console.log('Received data from the new window:', receivedData);

                resolve(receivedData);
            }
        }

        window.addEventListener('message', messageHandler);
    });
}

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
        return await securelyCall(method, endpoint, params, token)
    } catch (error) {
        throw error;
    }
}

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

function getProviders(methodId) {
    return securelyCall('getProviders', 'onboarding', {methodId: methodId});
}

function computeMethodId(chainId, dappAddr, functionSelector=null) {
    return (functionSelector !== null) ?
        `${chainId}-${dappAddr.replace(/^0x/, '')}-${functionSelector.replace(/^0x/, '')}` :
        `${chainId}-${dappAddr.replace(/^0x/, '')}`;
}

function validateEthTransferCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, amount) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendEthTransfer', chainId.toString(), [methodId, srcAddr, destAddr, amount, ""], methodId);
}
function validateEthTransferWithDataCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, amount, data) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendEthTransfer', chainId.toString(), [methodId, srcAddr, destAddr, amount, data], methodId);
}
function validateErc20TransferCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, tokenAddr, amount) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendErc20Transfer', chainId.toString(), [methodId, srcAddr, destAddr, tokenAddr, amount, ""], methodId);
}
function validateErc20TransferWithDataCompliance(chainId, dappAddr, functionSelector, srcAddr, destAddr, tokenAddr, amount, data) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendErc20Transfer', chainId.toString(), [methodId, srcAddr, destAddr, tokenAddr, amount, data], methodId);
}
function validateGenericCallCompliance(chainId, dappAddr, functionSelector, srcAddr, amount, data) {
    amount = amount.toString(16);
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return securelyCallAutoAuth('sendGenericCall', chainId.toString(), [methodId, srcAddr, destAddr, amount, data], methodId);
}

function validateUser(chainId, dappAddr) {
    const methodId = computeMethodId(chainId, dappAddr);
    return securelyCallAutoAuth('validateUser', chainId.toString(), [methodId], methodId);
}

function showPolicyById(id, formatted = true) {
    return securelyCall('showPolicy', '', {id: id, formatted: formatted});
}

function showPolicy(chainId, dappAddr, functionSelector, formatted = true) {
    const methodId = computeMethodId(chainId, dappAddr, functionSelector);
    return showPolicyById(methodId, formatted);
}

function listPolicies(chainId, dappAddr) {
    return securelyCall('listPolicies', '', {chainId: chainId, dappAddr: dappAddr});
}

async function isSCProtected(chainId, dappAddr) {
    res = await securelyCall('listPolicies', '', {chainId: chainId, dappAddr: dappAddr});
    return (res.result.length !== 0)
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
