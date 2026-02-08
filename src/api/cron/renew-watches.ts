import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renewExpiredWatches } from '../../api/controllers/google.controller';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    try {
        await renewExpiredWatches();
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false });
    }
}
