import path from 'path'
import fs from 'node:fs/promises'
import streamConsumers from 'node:stream/consumers'

/**
 * Wrapper class for buffers, keeps track of current position -> advances every read
 */
class StreamingBuffer {
    
    /** @type {Buffer} */
    _buffer
    
    /** @type {number} */
    _position
    
    /** @type {Buffer} */
    get buffer() { return this._buffer }
    
    /** @type {number} */
    get position() { return this._position }

    /**
     * @param {Buffer} buffer
     */
    constructor(buffer) {
        this._buffer = buffer
        this._position = 0
    }
    
    /**
     * Create a new {@link StreamingBuffer} from a stream
     * 
     * @see {streamConsumers.buffer}
     * @param {Readable} stream
     * @constructor
     */
    static async FromStream(stream) {
        return new StreamingBuffer(
            await streamConsumers.buffer(stream)
        )
    }

    /**
     * Resets the buffer position back to 0
     */
    reset() {
        this._position = 0
    }

    /**
     * Advance the buffer by {@link amount}
     *
     * @param {number} amount
     */
    advance(amount) {
        this._position += amount
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
     * Reads an unsigned 8 bits integer at the current position without advancing
     *
     * @see {Buffer.readUint8}
     * @returns {number}
     */
    peakUint8() {
        const value = this._buffer.readUint8(this._position)
        this._position++
        return value
    }

    /**
     * Reads an unsigned 16 bits integer at the current position and advances the position by two
     *
     * @see {Buffer.readUInt16LE}
     * @returns {number}
     */
    readUInt16LE() {
        // readUInt8 << 4 | readUInt8
        
        const value = this._buffer.readUInt16LE(this._position)
        this._position += 2
        return value
    }

    /**
     * Reads an unsigned 32 bits integer at the current position and advances the position by four
     *
     * @see {Buffer.readUInt32LE}
     * @returns {number}
     */
    readUInt32LE() {
        const value = this._buffer.readInt32LE(this._position)
        this._position += 4
        return value
    }

    /**
     * Read a chunk as buffer of the given size at the current position advancing the position by {@link size}
     * 
     * @param size
     * @returns {*}
     */
    readChunk(size) {
        throw 'Not implemented yet'
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
     * Reads an individual char at the current position without advancing
     *
     * @see {Buffer.readUint8}
     * @returns {string}
     */
    peakChar() {
        return String.fromCharCode(this.peakUint8())
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

    /**
     * Reads a string of length {@link length} characters starting at the current position without advancing
     *
     * @param {number} length
     * @returns {string}
     */
    peakString(length) {
        let value = ''
        for ( let i = 0; i < length; i++ ) value += this.peakChar()
        return value
    }
}

// todo: document type, create WaveFile class for controlled data access + parsing?
let fmtChunk = undefined

await readFile(
    path.join(import.meta.dirname, '../../data/file_example_WAV_1MG.wav')
)



async function readFile(filePath) {
    const handle = await fs.open(filePath)
    const stream = handle.createReadStream()
    const buff=  await StreamingBuffer.FromStream(stream)


    // RIFF chunk (0x52 0x49 0x46 0x46), resource interchangable file format
    const isRIFF = buff.readUint8() === 0x52 &&
        buff.readUint8() === 0x49 &&
        buff.readUint8() === 0x46 &&
        buff.readUint8() === 0x46;

    // filesize - 4 (WAVE) - 4 (own size)
    let chunkSize = buff.readUInt32LE()
    
    
    // Assume WAVE (0x57 0x41 0x56 0x45)
    const waveID = buff.readString(4);
    
    const chunk = readChunk(buff)
    fmtChunk = chunk
    
    const dataChunk = readChunk(buff)
}

/**
 * Read a chunk from the buffer
 * 
 * @param {StreamingBuffer} buff
 */
function readChunk(buff) {
    // alternative way of chunk handling: read data into array buffer -> have getter functions based acting on that
    
    const chunkId = buff.readString(4)
    const chunkSize = buff.readUInt32LE()
    
    if (chunkId === 'fmt ') {
        return {
            chunkId: chunkId,
            chunkSize: chunkSize,
            content: readFmtChunk(buff, chunkSize)
        }
    }
    
    if (chunkId === 'fact') {
        return {
            chunkId: chunkId,
            chunkSize: chunkSize,
            content: readFactChunk(buff, chunkSize),
        }
    }
    
    if (chunkId === 'data') {
        return {
            chunkId: chunkId,
            chunkSize: chunkSize,
            content: readDataChunk(buff, chunkSize)
        }
    }
    
    // unknown chunk type -> skip
    buff.advance(chunkSize)
}

/**
 * Read a format chunk from the buffer, position expected to be at the start of the chunk's size
 * 
 * @param {StreamingBuffer} buff
 * @param {number} chunkSize
 * @returns {{formatCode: number, bitsPerSample: number, speakerPositionMask: number, channels: number, validBits: number, subFormat: number, dataRate: number, sampleRate: number, blockSize: number, extensionSize: number}}
 */
function readFmtChunk(buff, chunkSize) {
    // chunkSize can be either 16, 18, or 40
    return {
        // wFormatTag (2 bytes, 2)
        formatCode: buff.readUInt16LE(),
        
        // nChannels (2 bytes, 4)
        channels: buff.readUInt16LE(),
        
        // nSamplesPerSec (4 bytes, 8)
        sampleRate: buff.readUInt32LE(),
        
        // nAvgBytesPerSec (4 bytes, 12)
        dataRate: buff.readUInt32LE(),

        // nBlockAlign (2 bytes, 14)
        blockSize: buff.readUInt16LE(),
 
        //wBitsPerSample (2 bytes, 16)
        bitsPerSample: buff.readUInt16LE(),
        
        // cbSize (2 bytes, 18)
        extensionSize: chunkSize >= 18 ?
            buff.readUInt16LE() :
            undefined,
        
        // wValidBitsPerSample (2 bytes, 20)
        validBits: chunkSize >= 40 ?
            buff.readUInt16LE() :
            undefined,
        
        // dwChannelMask (4 bytes, 24)
        speakerPositionMask: chunkSize >= 40 ?
            buff.readUInt32LE() :
            undefined,
        
        // SubFormat (16 bytes, 40)
        subFormat: chunkSize >= 40 ? 
            buff.readString(16) :
            undefined
    }
}

/**
 * Read a fact chunk from the buffer, position expected to be at the start of the chunk's size
 * 
 * @param {StreamingBuffer} buff
 * @param {number} chunkSize
 * @return {{samplesPerChannel: (number|number|*)}}
 */
function readFactChunk(buff, chunkSize) {
    // consume chunksize, minimum of 4
    return {
        // dwSampleLength (4 bytes, 4)
        samplesPerChannel: buff.readUInt32LE()
    }
}

/**
 * 
 * @param {StreamingBuffer} buff
 * @param {number} chunkSize
 */
function readDataChunk(buff, chunkSize) {
    return {
        samples: chunkSize / fmtChunk.content.channels,
        length: chunkSize / fmtChunk.content.dataRate
    }
}













