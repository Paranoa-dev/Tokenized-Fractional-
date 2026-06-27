import React, { useState } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Alert from '../Alert/Alert';
import styles from './EmergencyWithdraw.module.css';

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || 'C...';
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org:443';
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

export default function EmergencyWithdraw({ publicKey }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [amount, setAmount] = useState('');

  const handleWithdraw = async () => {
    if (!publicKey || CONTRACT_ID.length < 50) {
      setError('Wallet must be connected and contract must be configured');
      return;
    }
    const parsedAmount = BigInt(amount);
    if (!amount || parsedAmount <= 0) {
      setError('Enter a valid positive amount to withdraw');
      return;
    }
    if (!confirm(`Emergency withdraw ${amount} tokens from the contract to ${publicKey.slice(0, 8)}…? Continue?`)) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { signTransaction } = await import('@stellar/freighter-api');
      const { rpc, TransactionBuilder, Contract, nativeToScVal } = await import('@stellar/stellar-sdk');
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);

      const account = await server.getAccount(publicKey);
      let tx = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'emergency_withdraw',
            nativeToScVal(publicKey, { type: 'address' }),
            nativeToScVal(parsedAmount, { type: 'i128' }),
          )
        )
        .setTimeout(30)
        .build();

      const simulation = await server.simulateTransaction(tx);
      if (simulation.error) throw new Error(simulation.error);

      tx = rpc.assembleTransaction(tx, simulation).build();
      const { signedTxXdr, error: signError } = await signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      if (signError || !signedTxXdr) throw new Error(signError?.message || 'Signing failed');

      const submitRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
      );

      setSuccess(`Emergency withdraw submitted! Tx: ${submitRes.hash}`);
    } catch (err) {
      setError(err.message || 'Emergency withdraw failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Emergency Withdraw</h3>
      <p className={styles.warning}>
        This will withdraw all tokens from the contract back to the admin address.
        Only use this in emergency situations.
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className={styles.inputRow}>
        <Input
          id="ew-amount"
          type="number"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
            setSuccess('');
          }}
          min="1"
          disabled={loading}
          placeholder="Amount to withdraw"
        />
      </div>

      <Button
        variant="danger"
        onClick={handleWithdraw}
        loading={loading}
        disabled={!publicKey || CONTRACT_ID.length < 50}
      >
        {loading ? 'Processing…' : 'Emergency Withdraw'}
      </Button>
    </div>
  );
}
