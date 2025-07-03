import { AuctionResult } from '../types';
import { callApi } from './api';

const BASE_URL = import.meta.env.VITE_API_URL;

export const getAuctionLog = async (token: string): Promise<Record<number, AuctionResult>> => {
  const resp = await callApi<{ data: { auctionLog: Record<number, AuctionResult> } }>(
    BASE_URL + '/api/get-auction-log',
    { method: 'GET' },
    token
  );
  return resp.data.auctionLog || {};
};

export const saveAuctionLog = async (token: string, auctionLog: Record<number, AuctionResult>) => {
  await callApi(
    BASE_URL + '/api/save-auction-log',
    {
      method: 'POST',
      body: JSON.stringify({ auctionLog })
    },
    token
  );
};
