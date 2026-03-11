import mongoose from 'mongoose';

//Helper for validate objectId
export const isValidateObjectId = (val: string) => {
    return mongoose.Types.ObjectId.isValid(val);
}