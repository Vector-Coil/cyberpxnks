import React from 'react';
import { redirect } from 'next/navigation';
import { getDbPool } from '../../../lib/db';
import { getNavStripData } from '../../../lib/navUtils';
import MessageDetailClient from './MessageDetailClient';

export default async function MessageDetailPage({ params }: { params: any }) {
  const p = await params;
  const messageId = parseInt(p.id, 10);
  
  if (Number.isNaN(messageId)) {
    return <div className="p-6 text-red-400">Invalid message ID</div>;
  }

  // Fetch NavStrip data for test user
  const navData = await getNavStripData(300187);

  try {
    const pool = await getDbPool();

    // Get user ID
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [300187]
    );
    const user = (userRows as any)[0];
    
    if (!user) {
      return <div className="p-6 text-red-400">User not found</div>;
    }

    // Fetch message with contact info (check both messages and messages_junk)
    // First try regular messages
    let [msgRows] = await pool.execute(
      `SELECT 
        m.id,
        m.msg_code,
        m.msg_title AS subject,
        m.msg_body AS body,
        m.contact AS contact_id,
        m.image_url AS message_image_url,
        m.btn_1,
        m.btn_2,
        c.display_name AS contact_name,
        c.image_url AS contact_image_url,
        mh.status,
        mh.unlocked_at,
        mh.read_at,
        'message' AS msg_type
      FROM msg_history mh
      JOIN messages m ON mh.msg_id = m.id AND mh.msg_type = 'message'
      LEFT JOIN contacts c ON m.contact = c.id
      WHERE mh.user_id = ? AND m.id = ?
      LIMIT 1`,
      [user.id, messageId]
    );

    let message = (msgRows as any)[0];

    // If not found, try junk messages
    if (!message) {
      [msgRows] = await pool.execute(
        `SELECT 
          mj.id,
          mj.msg_code,
          mj.msg_title AS subject,
          mj.msg_body AS body,
          NULL AS contact_id,
          mj.image_url AS message_image_url,
          mj.btn_1,
          mj.btn_2,
          mj.sent_from AS contact_name,
          NULL AS contact_image_url,
          mh.status,
          mh.unlocked_at,
          mh.read_at,
          'junk' AS msg_type
        FROM msg_history mh
        JOIN messages_junk mj ON mh.msg_id = mj.id AND mh.msg_type = 'junk'
        WHERE mh.user_id = ? AND mj.id = ?
        LIMIT 1`,
        [user.id, messageId]
      );
      message = (msgRows as any)[0];
    }

    if (!message) {
      redirect('/messages');
    }

    // Mark as read if unread
    if (message.status === 'UNREAD') {
      await pool.execute(
        'UPDATE msg_history SET status = ?, read_at = NOW() WHERE user_id = ? AND msg_id = ?',
        ['READ', user.id, messageId]
      );
      message.status = 'READ';
    }

    return <MessageDetailClient message={message} navData={{ ...navData, cxBalance: 0 }} userFid={300187} />;
  } catch (err: any) {
    console.error('Message detail error:', err);
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load message</div>
          <div className="text-sm text-gray-300">{err.message}</div>
        </div>
      </div>
    );
  }
}
