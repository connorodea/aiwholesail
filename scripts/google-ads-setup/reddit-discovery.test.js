#!/usr/bin/env node
/**
 * Tests for reddit-discovery.js — node:test, no external deps.
 * Run: node scripts/google-ads-setup/reddit-discovery.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseRedditSearchResponse,
  isQuestionTitle,
  rankByEngagement,
  filterRelevantSubs,
  toCsv,
} = require('./reddit-discovery.js');

const FIXTURE = JSON.stringify({
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          title: 'How do I find motivated sellers in a small market?',
          subreddit: 'realestateinvesting',
          score: 142,
          num_comments: 38,
          permalink: '/r/realestateinvesting/comments/abc/how_do_i_find/',
          url: 'https://reddit.com/r/realestateinvesting/comments/abc/',
          created_utc: 1714600000,
          author: 'investor_42',
        },
      },
      {
        kind: 't3',
        data: {
          title: 'My subject-to deal fell apart at closing — what went wrong?',
          subreddit: 'WholesalingHouses',
          score: 56,
          num_comments: 21,
          permalink: '/r/WholesalingHouses/comments/def/my_subject_to/',
          url: 'https://reddit.com/r/WholesalingHouses/comments/def/',
          created_utc: 1714700000,
          author: 'wholesaler_99',
        },
      },
      {
        kind: 't3',
        data: {
          title: 'Just closed my first wholesale deal! $12K assignment fee',
          subreddit: 'realestateinvesting',
          score: 280,
          num_comments: 64,
          permalink: '/r/realestateinvesting/comments/ghi/just_closed/',
          url: 'https://reddit.com/r/realestateinvesting/comments/ghi/',
          created_utc: 1714800000,
          author: 'newbie',
        },
      },
    ],
  },
});

test('parseRedditSearchResponse extracts posts with title/sub/score/comments', () => {
  const posts = parseRedditSearchResponse(FIXTURE);
  assert.equal(posts.length, 3);
  assert.equal(posts[0].title, 'How do I find motivated sellers in a small market?');
  assert.equal(posts[0].subreddit, 'realestateinvesting');
  assert.equal(posts[0].score, 142);
  assert.equal(posts[0].num_comments, 38);
  assert.equal(posts[0].url, 'https://reddit.com/r/realestateinvesting/comments/abc/');
});

test('parseRedditSearchResponse returns [] for malformed payloads', () => {
  assert.deepEqual(parseRedditSearchResponse(''), []);
  assert.deepEqual(parseRedditSearchResponse('not json'), []);
  assert.deepEqual(parseRedditSearchResponse('{}'), []);
  assert.deepEqual(parseRedditSearchResponse('{"data":{}}'), []);
});

test('isQuestionTitle detects question-style titles for PAA mining', () => {
  assert.equal(isQuestionTitle('How do I find motivated sellers?'), true);
  assert.equal(isQuestionTitle('What is the BRRRR method'), true);
  assert.equal(isQuestionTitle('Can you wholesale without a license?'), true);
  assert.equal(isQuestionTitle('Anyone else having issues with PropStream?'), true);
  assert.equal(isQuestionTitle('Why does my deal keep falling through'), true);
  assert.equal(isQuestionTitle('Just closed my first deal — $12K assignment fee'), false);
  assert.equal(isQuestionTitle('My experience with skip tracing'), false);
});

test('rankByEngagement sorts posts by score + comments * 2 desc', () => {
  const posts = parseRedditSearchResponse(FIXTURE);
  const ranked = rankByEngagement(posts);
  // post3: 280 + 64*2 = 408
  // post1: 142 + 38*2 = 218
  // post2: 56 + 21*2 = 98
  assert.equal(ranked[0].title.startsWith('Just closed'), true);
  assert.equal(ranked[1].title.startsWith('How do I'), true);
  assert.equal(ranked[2].title.startsWith('My subject-to'), true);
  assert.ok(ranked[0].engagement === 408);
});

test('filterRelevantSubs matches subreddit names by case-insensitive substring', () => {
  const posts = parseRedditSearchResponse(FIXTURE);
  // exact match still works
  const filtered = filterRelevantSubs(posts, ['realestateinvesting']);
  assert.equal(filtered.length, 2);
  // case-insensitive
  const filtered2 = filterRelevantSubs(posts, ['WHOLESALINGHOUSES']);
  assert.equal(filtered2.length, 1);
  // substring catches sub-name variants (e.g. 'estate' would also catch 'TorontoRealEstate' in live data)
  const filtered3 = filterRelevantSubs(posts, ['estate']);
  assert.equal(filtered3.length, 2); // both 'realestateinvesting' contain 'estate'
  // multiple patterns OR-combine
  const filtered4 = filterRelevantSubs(posts, ['estate', 'wholesal']);
  assert.equal(filtered4.length, 3);
});

test('toCsv produces seed,subreddit,score,comments,engagement,question,title,url columns', () => {
  const rows = [
    {
      seed: 'subject to',
      title: 'How do I structure subject-to deals?',
      subreddit: 'realestateinvesting',
      score: 100,
      num_comments: 20,
      engagement: 140,
      url: 'https://reddit.com/r/x/abc',
      is_question: true,
    },
  ];
  const csv = toCsv(rows);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'seed,subreddit,score,comments,engagement,question,title,url');
  assert.equal(
    lines[1],
    'subject to,realestateinvesting,100,20,140,yes,How do I structure subject-to deals?,https://reddit.com/r/x/abc'
  );
});
