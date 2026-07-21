import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  type Types,
} from 'mongoose';

export interface IConversation {
  listing?: Types.ObjectId | null;
  participants: Types.ObjectId[];
  created_at: Date;
  updated_at: Date;
}

export type ConversationDocument =
  HydratedDocument<IConversation>;

const conversationSchema =
  new Schema<IConversation>(
    {
      listing: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        default: null,
        index: true,
      },

      participants: {
        type: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
        ],
        required: true,
        validate: [
          {
            validator(
              participants: Types.ObjectId[]
            ) {
              return participants.length >= 2;
            },
            message:
              'A conversation must have at least two participants',
          },
          {
            validator(
              participants: Types.ObjectId[]
            ) {
              const uniqueParticipants =
                new Set(
                  participants.map(
                    (participant) =>
                      participant.toString()
                  )
                );

              return (
                uniqueParticipants.size ===
                participants.length
              );
            },
            message:
              'Conversation participants must be unique',
          },
        ],
      },
    },
    {
      timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },

      versionKey: false,

      collection: 'conversations',
    }
  );

conversationSchema.index({
  participants: 1,
  updated_at: -1,
});

conversationSchema.index({
  listing: 1,
  participants: 1,
});

const Conversation: Model<IConversation> =
  models.Conversation ||
  model<IConversation>(
    'Conversation',
    conversationSchema
  );

export default Conversation;