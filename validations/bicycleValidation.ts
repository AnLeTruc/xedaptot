import { z } from 'zod';

//Schema for object image/video
const mediaItemSchema = z.object({
    url: z.string().url(),
    isPrimary: z.boolean(),
    mediaType: z.enum(['image', 'video'])
});

