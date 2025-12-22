"use client";
import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';

// ERC20 ABI for balanceOf function
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// $CX Token Contract Address (Base network)
// TODO: Update this with your actual deployed token contract address
const CX_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Hook to fetch $CX token balance from connected wallet
 * Returns the balance as a number (not including decimals)
 */
export function useCxTokenBalance() {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState<number>(0);

  // Read token balance
  const { data: balanceData, isError, isLoading } = useReadContract({
    address: CX_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  // Read token decimals
  const { data: decimalsData } = useReadContract({
    address: CX_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: isConnected,
    },
  });

  useEffect(() => {
    if (balanceData && decimalsData) {
      // Convert from wei-like units to human-readable format
      const decimals = Number(decimalsData);
      const rawBalance = BigInt(balanceData.toString());
      const divisor = BigInt(10 ** decimals);
      const humanReadableBalance = Number(rawBalance / divisor);
      setBalance(humanReadableBalance);
    } else if (!isConnected) {
      setBalance(0);
    }
  }, [balanceData, decimalsData, isConnected]);

  return {
    balance,
    isLoading,
    isError,
    isConnected,
  };
}
