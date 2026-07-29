import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  api,
  type Conversation,
  type Message,
} from '../api/client';

import { useAuth } from '../context/AuthContext';
import { Send } from 'lucide-react';

/**
 * Returns either a MongoDB _id or a legacy id as a string.
 *
 * MongoDB ObjectIds must never be converted with Number().
 */
function getDocumentId(
  document:
    | {
        _id?: string;
        id?: string | number;
      }
    | null
    | undefined
): string | undefined {
  const documentId =
    document?._id ?? document?.id;

  if (
    documentId === undefined ||
    documentId === null
  ) {
    return undefined;
  }

  return String(documentId);
}

/**
 * Converts an unknown error into a readable message.
 */
function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/**
 * Safely formats a message timestamp.
 */
function formatDateTime(
  dateValue?: string
): string {
  if (!dateValue) {
    return '';
  }

  const parsedDate =
    new Date(dateValue);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return '';
  }

  return parsedDate.toLocaleString();
}

export default function MessagesPage() {
  const { id } =
    useParams<{ id?: string }>();

  const { user } = useAuth();

  const [
    conversations,
    setConversations,
  ] = useState<Conversation[]>([]);

  const [
    messages,
    setMessages,
  ] = useState<Message[]>([]);

  const [
    newMessage,
    setNewMessage,
  ] = useState<string>('');

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState<boolean>(true);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState<boolean>(false);

  const [
    sendingMessage,
    setSendingMessage,
  ] = useState<boolean>(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string>('');

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const currentUserId =
    getDocumentId(user);

  /**
   * Loads every conversation belonging to the signed-in user.
   */
  const loadConversations =
    useCallback(
      async (): Promise<void> => {
        setLoadingConversations(true);
        setErrorMessage('');

        try {
          const response =
            await api.get<
              Conversation[]
            >('/conversations');

          setConversations(
            Array.isArray(response)
              ? response
              : []
          );
        } catch (error) {
          console.error(
            'Unable to load conversations:',
            error
          );

          setConversations([]);

          setErrorMessage(
            `Unable to load conversations: ${getErrorMessage(
              error
            )}`
          );
        } finally {
          setLoadingConversations(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  /**
   * Loads the messages whenever the selected conversation changes.
   */
  useEffect(() => {
    if (!id) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages =
      async (): Promise<void> => {
        setLoadingMessages(true);
        setErrorMessage('');

        try {
          const response =
            await api.get<Message[]>(
              `/conversations/${id}/messages`
            );

          if (!cancelled) {
            setMessages(
              Array.isArray(response)
                ? response
                : []
            );
          }
        } catch (error) {
          console.error(
            'Unable to load messages:',
            error
          );

          if (!cancelled) {
            setMessages([]);

            setErrorMessage(
              `Unable to load messages: ${getErrorMessage(
                error
              )}`
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingMessages(false);
          }
        }
      };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /**
   * Scrolls to the newest message after the conversation loads
   * or a new message is added.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  /**
   * Sends a message inside the selected conversation.
   */
  const sendMessage = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    const trimmedMessage =
      newMessage.trim();

    if (
      !id ||
      !trimmedMessage ||
      sendingMessage
    ) {
      return;
    }

    setSendingMessage(true);
    setErrorMessage('');

    try {
      const message =
        await api.post<Message>(
          `/conversations/${id}/messages`,
          {
            content: trimmedMessage,
          }
        );

      setMessages(
        (previousMessages) => [
          ...previousMessages,
          message,
        ]
      );

      setNewMessage('');

      /*
       * Refresh the conversation list so its latest-message
       * preview and sorting are updated.
       */
      await loadConversations();
    } catch (error) {
      console.error(
        'Unable to send message:',
        error
      );

      setErrorMessage(
        `Unable to send message: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /*
   * Compare IDs as strings.
   *
   * The previous code used Number(id), which turns a MongoDB
   * ObjectId into NaN and prevents the conversation from opening.
   */
  const activeConversation =
    conversations.find(
      (conversation) =>
        getDocumentId(
          conversation
        ) === id
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">
        Messages
      </h1>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-6 grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:h-[600px] lg:grid-cols-3">
        {/* Conversation list */}
        <div className="overflow-y-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
          {loadingConversations ? (
            <p className="p-4 text-sm text-slate-500">
              Loading conversations...
            </p>
          ) : conversations.length ===
            0 ? (
            <p className="p-4 text-sm text-slate-500">
              No conversations yet
            </p>
          ) : (
            conversations.map(
              (conversation) => {
                const conversationId =
                  getDocumentId(
                    conversation
                  );

                if (!conversationId) {
                  return null;
                }

                const isActive =
                  id === conversationId;

                return (
                  <Link
                    key={
                      conversationId
                    }
                    to={`/messages/${conversationId}`}
                    className={`block cursor-pointer border-b border-slate-100 p-4 transition hover:bg-campus-50 ${
                      isActive
                        ? 'bg-campus-50'
                        : 'bg-white'
                    }`}
                  >
                    <p className="font-medium text-slate-900">
                      {conversation.other_participant
                        ? `${conversation.other_participant.first_name} ${conversation.other_participant.last_name}`
                        : 'Conversation'}
                    </p>

                    {conversation.listing && (
                      <p className="mt-0.5 text-xs text-campus-600">
                        {
                          conversation
                            .listing
                            .title
                        }
                      </p>
                    )}

                    {conversation.last_message && (
                      <p className="mt-1 line-clamp-2 break-words text-sm text-slate-400">
                        {
                          conversation
                            .last_message
                            .content
                        }
                      </p>
                    )}
                  </Link>
                );
              }
            )
          )}
        </div>

        {/* Selected conversation */}
        <div className="flex min-h-[500px] flex-col lg:col-span-2 lg:min-h-0">
          {id &&
          activeConversation ? (
            <>
              <div className="border-b border-slate-100 p-4">
                <p className="font-semibold text-slate-900">
                  {activeConversation.other_participant
                    ? `${activeConversation.other_participant.first_name} ${activeConversation.other_participant.last_name}`
                    : 'Chat'}
                </p>

                {activeConversation.listing && (
                  <p className="mt-0.5 text-xs text-campus-600">
                    {
                      activeConversation
                        .listing.title
                    }
                  </p>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Loading messages...
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    No messages in this conversation
                  </div>
                ) : (
                  messages.map(
                    (message) => {
                      const messageId =
                        getDocumentId(
                          message
                        );

                      const senderId =
                        String(
                          message.sender_id
                        );

                      const isMine =
                        Boolean(
                          currentUserId &&
                            senderId ===
                              currentUserId
                        );

                      return (
                        <div
                          key={
                            messageId ??
                            `${message.sender_id}-${message.created_at}`
                          }
                          className={`flex ${
                            isMine
                              ? 'justify-end'
                              : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                              isMine
                                ? 'rounded-br-md bg-campus-600 text-white'
                                : 'rounded-bl-md bg-slate-100 text-slate-800'
                            }`}
                          >
                            {!isMine && (
                              <p className="mb-0.5 text-xs font-medium opacity-70">
                                {message.first_name ||
                                  activeConversation
                                    .other_participant
                                    ?.first_name ||
                                  'User'}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words">
                              {
                                message.content
                              }
                            </p>

                            <p
                              className={`mt-1 text-[10px] ${
                                isMine
                                  ? 'text-campus-200'
                                  : 'text-slate-400'
                              }`}
                            >
                              {formatDateTime(
                                message.created_at
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )
                )}

                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex gap-2 border-t border-slate-100 p-4"
              >
                <input
                  className="input-field flex-1"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(event) =>
                    setNewMessage(
                      event.target.value
                    )
                  }
                  disabled={
                    sendingMessage
                  }
                  maxLength={2000}
                />

                <button
                  type="submit"
                  disabled={
                    sendingMessage ||
                    !newMessage.trim()
                  }
                  aria-label="Send message"
                  className="btn-primary !px-4 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}