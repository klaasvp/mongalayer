import { describe, expect, test } from 'vitest';
import { MongalayerClient } from '../src';

describe('Db', () => {
    describe('batch', () => {
        test('should throw error when client format is routed', async () => {
            const client = new MongalayerClient("http://localhost", { format: "routed" });

            const db = client.db("test");

            await expect(db.batch([
                {
                    collection: "test",
                    operation: "find",
                    payload: {
                        filter: {}
                    }
                }
            ])).rejects.toThrow("Batch operations are not supported in routed format");
        });

        test('should not throw error when client format is json', async () => {
            const client = new MongalayerClient("http://localhost", { format: "json" });

            const db = client.db("test");

            await expect(db.batch([
                {
                    collection: "test",
                    operation: "find",
                    payload: {
                        filter: {}
                    }
                }
            ])).resolves.not.toThrow();
        });
    });
});