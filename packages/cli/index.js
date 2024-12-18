import path from 'path'
import fs from 'node:fs/promises'
import streamConsumers from 'node:stream/consumers'

/**
 * Wrapper class for buffers, keeps track of current position -> advances every read
 */
class AutoAdvancingBuffer {
    
    /** @type {Buffer} */
    _buffer
    
    /** @type {number} */
    _position

    /**
     * @param {Buffer} buffer
     */
    constructor(buffer) {
        this._buffer = buffer
        this._position = 0
    }

    /**
     * Resets the buffer position back to 0
     */
    reset() {
        this._position = 0
    }

    /**
     * Reads an unsigned 8 bits integer at the current position and advances the position by one
     * 
     * @see {Buffer.readUint8}
     * @returns {number}
     */
    readUint8() {
        const value = this._buffer.readUint8(this._position)
        this._position++
        return value
    }

    /**
     * Reads an unsigned 64 bits integer at the current position and advances the position by four
     *
     * @see {Buffer.readUint8}
     * @returns {bigint}
     */
    readBigUInt64LE() {
        const value = this._buffer.readBigUInt64LE(this._position)
        this._position += 4
        return value
    }

    /**
     * Reads an individual char at the current position and advances the position by one
     *
     * @see {Buffer.readUint8}
     * @returns {string}
     */
    readChar() {
        return String.fromCharCode(this.readUint8())
    }

    /**
     * Reads a string of length {@link length} characters starting at the current position and advances the position by {@link length}
     * 
     * @param {number} length
     * @returns {string}
     */
    readString(length) {
        let value = ''
        for ( let i = 0; i < length; i++ ) value += this.readChar()
        return value
    }
}



await readFile(
    path.join(import.meta.dirname, '../../data/file_example_WAV_1MG.wav')
)

async function readFile(filePath) {
    const handle = await fs.open(filePath)
    const stream = handle.createReadStream()
    const buff=  new AutoAdvancingBuffer(await streamConsumers.buffer(stream))


    // RIFF chunk (0x52 0x49 0x46 0x46), resource interchangable file format
    const isRIFF = buff.readUint8() === 0x52 &&
        buff.readUint8() === 0x49 &&
        buff.readUint8() === 0x46 &&
        buff.readUint8() === 0x46;

    // advance
    buff.readBigUInt64LE()
    
    // Assume WAVE (0x57 0x41 0x56 0x45)
    const waveID = buff.readString(4);
    
    
}

