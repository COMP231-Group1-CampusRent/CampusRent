import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

export interface IMessage {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  read_by: Types.ObjectId[];
  created_at: Date;
  updated_at: Date;
}

export type MessageDocument =
  HydratedDocument<IMessage>;

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [
        true,
        'Conversation is required',
      ],
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [
        true,
        'Message sender is required',
      ],
      index: true,
    },

    content: {
      type: String,
      required: [
        true,
        'Message content is required',
      ],
      trim: true,
      minlength: [
        1,
        'Message content cannot be empty',
      ],
      maxlength: [
        3000,
        'Message content cannot exceed 3000 characters',
      ],
    },

    read_by: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },

    versionKey: false,

    collection: 'messages',
  }
);

messageSchema.index({
  conversation: 1,
  created_at: 1,
});

messageSchema.index({
  sender: 1,
  created_at: -1,
});

messageSchema.index({
  conversation: 1,
  read_by: 1,
});

const Message: Model<IMessage> =
  models.Message ||
  model<IMessage>(
    'Message',
    messageSchema
  );

export default Message;