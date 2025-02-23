import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { DiceGame } from '../target/types/dice_game'
import { randomBytes } from 'crypto'
import {
    Ed25519Program,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Transaction,
} from '@solana/web3.js'

describe('dice-game', () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env())

    const program = anchor.workspace.DiceGame as Program<DiceGame>
    const MSG = Uint8Array.from(Buffer.from('1337', 'hex'))

    let house = new Keypair()
    let player = new Keypair()
    let seed = new anchor.BN(randomBytes(10))
    let vault = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), house.publicKey.toBuffer()],
        program.programId,
    )[0]
    let bet = PublicKey.findProgramAddressSync(
        [Buffer.from('bet'), vault.toBuffer(), seed.toBuffer('le', 16)],
        program.programId,
    )[0]
    let tx: Uint16Array

    it('Airdrop', async () => {
        await Promise.all(
            [house, player].map(async (k) => {
                return await anchor
                    .getProvider()
                    .connection.requestAirdrop(
                        k.publicKey,
                        1000 * anchor.web3.LAMPORTS_PER_SOL,
                    )
                    .then(confirmTx)
            }),
        )
    })

    it('Is initialized!', async () => {
        // Add your test here.

        const tx = await program.methods
            .initialize(new anchor.BN(LAMPORTS_PER_SOL).mul(new anchor.BN(100)))
            .accounts({
                house: house.publicKey,
                vault: vault,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([house])
            .rpc()
            .then(confirmTx)
        console.log('your transaction signature:', tx)
    })

    it('Place a bet', async () => {
        let tx = await program.methods
            .placeBet(seed, 50, new anchor.BN(LAMPORTS_PER_SOL / 100))
            .accounts({
                player: player.publicKey,
                house: house.publicKey,
                vault: vault,
                bet: bet,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([player])
            .rpc()
            .then(confirmTx)

        console.log('Your txn signature:', tx)
    })

    it('Resolve a bet', async () => {
        let account = await anchor
            .getProvider()
            .connection.getAccountInfo(bet, 'confirmed')

        let sig_ix = Ed25519Program.createInstructionWithPrivateKey({
            privateKey: house.secretKey,
            message: account.data.subarray(8),
        })

        const resolve_ix = await program.methods
            .resolveBet(
                Buffer.from(sig_ix.data.buffer.slice(16 + 32, 16 + 32 + 64)),
            )
            .accounts({
                player: player.publicKey,
                house: house.publicKey,
                vault: vault,
                bet,
                instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
                systemProgram: SystemProgram.programId,
            } as any).signers([house]).instruction()

        const tx = new Transaction().add(sig_ix).add(resolve_ix)

        try {
            await sendAndConfirmTransaction(program.provider.connection, tx, [
                house, player
            ])
        } catch (error) {
            console.error(error)
            throw(error)
        }
    })
})

const confirmTx = async (signature: string) => {
    const blockHash = await anchor.getProvider().connection.getLatestBlockhash()
    await anchor.getProvider().connection.confirmTransaction(
        {
            signature,
            ...blockHash,
        },
        'confirmed',
    )
    return signature
}
