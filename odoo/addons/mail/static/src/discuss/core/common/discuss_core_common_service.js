import { reactive } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

export class DiscussCoreCommon {
    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {Partial<import("services").Services>} services
     */
    constructor(env, services) {
        this.busService = services.bus_service;
        this.env = env;
        this.notificationService = services.notification;
        this.orm = services.orm;
        this.presence = services.presence;
        this.store = services["mail.store"];
    }

    setup() {
        this.busService.subscribe("discuss.channel/joined", async (payload) => {
            const { channel, invited_by_user_id: invitedByUserId } = payload;
            const thread = this.store.Thread.insert(channel);
            await thread.fetchChannelInfo();
            if (invitedByUserId && invitedByUserId !== this.store.self.userId) {
                this.notificationService.add(
                    _t("You have been invited to #%s", thread.displayName),
                    { type: "info" }
                );
            }
        });
        this.busService.subscribe("discuss.channel/leave", (payload) => {
            const thread = this.store.Thread.insert(payload);
            this.notificationService.add(_t("You unsubscribed from %s.", thread.displayName), {
                type: "info",
            });
            thread.delete();
        });
        this.busService.subscribe("discuss.channel/delete", (payload, { id: notifId }) => {
            const thread = this.store.Thread.insert({
                id: payload.id,
                model: "discuss.channel",
            });
            const filteredStarredMessages = [];
            let starredCounter = 0;
            for (const msg of this.store.discuss.starred.messages) {
                if (!msg.thread?.eq(thread)) {
                    filteredStarredMessages.push(msg);
                } else {
                    starredCounter++;
                }
            }
            this.store.discuss.starred.messages = filteredStarredMessages;
            if (notifId > this.store.discuss.starred.counter_bus_id) {
                this.store.discuss.starred.counter -= starredCounter;
            }
            this.store.discuss.inbox.messages = this.store.discuss.inbox.messages.filter(
                (msg) => !msg.thread?.eq(thread)
            );
            if (notifId > this.store.discuss.inbox.counter_bus_id) {
                this.store.discuss.inbox.counter -= thread.message_needaction_counter;
            }
            this.store.discuss.history.messages = this.store.discuss.history.messages.filter(
                (msg) => !msg.thread?.eq(thread)
            );
            thread.closeChatWindow?.();
            if (thread.eq(this.store.discuss.thread)) {
                this.store.discuss.inbox.setAsDiscussThread();
            }
            thread.messages.splice(0, thread.messages.length);
            thread.delete();
        });
        this.busService.subscribe("discuss.channel/new_message", (payload, metadata) =>
            this._handleNotificationNewMessage(payload, metadata)
        );
        this.busService.subscribe("discuss.channel/transient_message", (payload) => {
            const { body, thread } = payload;
            const lastMessageId = this.store.getLastMessageId();
            const message = this.store.Message.insert(
                {
                    author: this.store.odoobot,
                    body,
                    id: lastMessageId + 0.01,
                    is_note: true,
                    is_transient: true,
                    thread,
                },
                { html: true }
            );
            message.thread.messages.push(message);
            message.thread.transientMessages.push(message);
        });
        this.busService.subscribe("discuss.channel/unpin", (payload) => {
            const thread = this.store.Thread.get({ model: "discuss.channel", id: payload.id });
            if (thread) {
                thread.is_pinned = false;
                this.notificationService.add(
                    _t("You unpinned your conversation with %s", thread.displayName),
                    { type: "info" }
                );
            }
        });
        this.busService.subscribe("discuss.channel.member/fetched", (payload) => {
            const { channel_id, id, last_message_id, partner_id } = payload;
            this.store.ChannelMember.insert({
                id,
                fetched_message_id: { id: last_message_id },
                persona: { type: "partner", id: partner_id },
                thread: { id: channel_id, model: "discuss.channel" },
            });
        });
        this.env.bus.addEventListener("mail.message/delete", ({ detail: { message, notifId } }) => {
            if (message.thread) {
                if (
                    (!message.thread.selfMember?.seen_message_id ||
                        message.id > message.thread.selfMember.seen_message_id.id) &&
                    notifId > message.thread.message_unread_counter_bus_id
                ) {
                    message.thread.message_unread_counter--;
                }
            }
        });
    }

    /**
     * todo: merge this with store.Thread.insert() (?)
     *
     * @returns {Thread}
     */
    createChannelThread(serverData) {
        const thread = this.store.Thread.insert({
            ...serverData,
            model: "discuss.channel",
            isAdmin:
                serverData.channel_type !== "group" &&
                serverData.create_uid === this.store.self.userId,
        });
        return thread;
    }

    async createGroupChat({ default_display_mode, partners_to }) {
        const data = await this.orm.call("discuss.channel", "create_group", [], {
            default_display_mode,
            partners_to,
        });
        const channel = this.createChannelThread(data);
        channel.open();
        return channel;
    }

    /**
     * @param {[number]} partnerIds
     * @param {boolean} inChatWindow
     */
    async startChat(partnerIds, inChatWindow) {
        const partners_to = [...new Set([this.store.self.id, ...partnerIds])];
        if (partners_to.length === 1) {
            const chat = await this.store.joinChat(partners_to[0], inChatWindow);
            chat.open(inChatWindow);
        } else if (partners_to.length === 2) {
            const correspondentId = partners_to.find(
                (partnerId) => partnerId !== this.store.self.id
            );
            const chat = await this.store.joinChat(correspondentId, inChatWindow);
            chat.open(inChatWindow);
        } else {
            await this.createGroupChat({ partners_to });
        }
    }

    async _handleNotificationNewMessage(payload, { id: notifId }) {
        const { id: channelId, message: messageData } = payload;
        const channel = await this.store.Thread.getOrFetch({
            model: "discuss.channel",
            id: channelId,
        });
        if (!channel) {
            return;
        }
        const temporaryId = messageData.temporary_id;
        messageData.temporary_id = null;
        const message = this.store.Message.insert(messageData, { html: true });
        if (message.notIn(channel.messages)) {
            if (!channel.loadNewer) {
                channel.addOrReplaceMessage(message, this.store.Message.get(temporaryId));
            } else if (channel.status === "loading") {
                channel.pendingNewMessages.push(message);
            }
            if (message.isSelfAuthored && channel.selfMember) {
                channel.selfMember.seen_message_id = message;
            } else {
                if (!channel.isDisplayed && channel.selfMember) {
                    channel.selfMember.syncUnread = true;
                    channel.scrollUnread = true;
                }
                if (notifId > channel.message_unread_counter_bus_id) {
                    channel.message_unread_counter++;
                }
            }
        }
        if (
            !channel.isCorrespondentOdooBot &&
            channel.channel_type !== "channel" &&
            this.store.self.type === "partner"
        ) {
            // disabled on non-channel threads and
            // on "channel" channels for performance reasons
            channel.markAsFetched();
        }
        if (
            !channel.loadNewer &&
            !message.isSelfAuthored &&
            channel.composer.isFocused &&
            this.store.self.type === "partner" &&
            channel.newestPersistentMessage?.eq(channel.newestMessage)
        ) {
            channel.markAsRead();
        }
        this.env.bus.trigger("discuss.channel/new_message", { channel, message });
        const authorMember = channel.channelMembers.find(({ persona }) =>
            persona?.eq(message.author)
        );
        if (authorMember) {
            authorMember.seen_message_id = message;
        }
    }
}

export const discussCoreCommon = {
    dependencies: [
        "bus_service",
        "mail.out_of_focus",
        "mail.store",
        "notification",
        "orm",
        "presence",
    ],
    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {Partial<import("services").Services>} services
     */
    start(env, services) {
        const discussCoreCommon = reactive(new DiscussCoreCommon(env, services));
        discussCoreCommon.setup(env, services);
        return discussCoreCommon;
    },
};

registry.category("services").add("discuss.core.common", discussCoreCommon);
