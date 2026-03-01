import * as dotenv from 'dotenv';
import { createApp } from '../src/app';

dotenv.config();

const app = createApp();

export default function handler(req: any, res: any) {
    return app(req, res);
}

export const config = {
    api: {
        bodyParser: false,
    },
};
