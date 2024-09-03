// websdk.d.ts
declare module '@securely.id/websdk' {
  function setDevMode(value): void;
  function getFees(chainId: string, dappAddr: string): Promise<any>;
  function getGrossAmount(chainId: string, dappAddr: string, amount: number): Promise<any>;
  function getProviders(methodId: string): Promise<any>;
  function securelyCallAutoAuth(method: string, endpoint: string, params: any[], methodId: string): Promise<any>;
  function securelyCall(method: string, endpoint: string, params: any, token?: string): Promise<any>;
  function validateEthTransferCompliance(chainId: string, dappAddr: string, functionSelector: string | null, srcAddr: string, destAddr: string, amount: number): Promise<any>;
  function validateEthTransferWithDataCompliance(chainId: string, dappAddr: string, functionSelector: string | null, srcAddr: string, destAddr: string, amount: number, data: string): Promise<any>;
  function validateErc20TransferCompliance(chainId: string, dappAddr: string, functionSelector: string | null, srcAddr: string, destAddr: string, tokenAddr: string, amount: number): Promise<any>;
  function validateErc20TransferWithDataCompliance(chainId: string, dappAddr: string, functionSelector: string | null, srcAddr: string, destAddr: string, tokenAddr: string, amount: number, data: string): Promise<any>;
  function validateGenericCallCompliance(chainId: string, dappAddr: string, functionSelector: string | null, srcAddr: string, amount: number, data: string): Promise<any>;
  function validateUser(chainId: string, dappAddr: string): Promise<any>;
  function showPolicyById(id: string, formatted?: boolean): Promise<any>;
  function showPolicy(chainId: string, dappAddr: string, functionSelector: string | null, formatted?: boolean): Promise<any>;
  function listPolicies(chainId: string, dappAddr: string): Promise<any>;
  function isSCProtected(chainId: string, dappAddr: string): Promise<boolean>;

  export {
    setDevMode,
    getFees,
    getGrossAmount,
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
