import mongoose from 'mongoose';

//Helper for validate objectId
export const isValidateObjectId = (val: string | string[]) => {
    if (Array.isArray(val)) return false;
    return mongoose.Types.ObjectId.isValid(val);
}