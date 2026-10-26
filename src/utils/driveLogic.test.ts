import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  getFileCategory,
  filterItems,
  sortItems,
  calculateAggregateStorage,
  buildBreadcrumbs,
  batchDeleteItems,
  batchRestoreItems,
  batchPermanentDeleteItems,
  batchMoveItems,
  matchesDateFilter,
  matchesSizeFilter,
  applyDeltaChanges,
  getAccountStorageDistribution,
  calculateStorageByCategory,
} from './driveLogic';
import { DriveItem, DriveAccount } from '../types/drive';

const sampleAccounts: DriveAccount[] = [
  {
    id: 'acc-1',
    name: 'Contoso Enterprise',
    email: 'alex@contoso.com',
    tenantName: 'contoso.onmicrosoft.com',
    accountType: 'business',
    color: '#0284c7',
    isLive: false,
    quota: { total: 1073741824000, used: 268435456000, remaining: 805306368000, state: 'normal' },
    connectedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'acc-2',
    name: 'Fabrikam Aerospace',
    email: 'alex@fabrikam.com',
    tenantName: 'fabrikam.onmicrosoft.com',
    accountType: 'business',
    color: '#10b981',
    isLive: false,
    quota: { total: 1073741824000, used: 536870912000, remaining: 536870912000, state: 'normal' },
    connectedAt: '2026-01-01T00:00:00.000Z',
  },
];

const sampleItems: DriveItem[] = [
  {
    id: 'f-1',
    name: 'Financial Reports',
    accountId: 'acc-1',
    accountName: 'Contoso Enterprise',
    accountColor: '#0284c7',
    parentId: null,
    isFolder: true,
    size: 0,
    lastModifiedDateTime: '2026-10-20T10:00:00.000Z',
    createdDateTime: '2026-10-01T10:00:00.000Z',
    webUrl: 'https://contoso.sharepoint.com/f-1',
    fileType: 'folder',
  },
  {
    id: 'doc-1',
    name: 'Q3_Balance_Sheet.xlsx',
    accountId: 'acc-1',
    accountName: 'Contoso Enterprise',
    accountColor: '#0284c7',
    parentId: 'f-1',
    isFolder: false,
    size: 1048576, // 1 MB
    lastModifiedDateTime: '2026-10-24T12:00:00.000Z',
    createdDateTime: '2026-10-10T10:00:00.000Z',
    webUrl: 'https://contoso.sharepoint.com/doc-1',
    fileType: 'spreadsheet',
    starred: true,
  },
  {
    id: 'doc-2',
    name: 'Pitch_Deck_2026.pptx',
    accountId: 'acc-2',
    accountName: 'Fabrikam Aerospace',
    accountColor: '#10b981',
    parentId: null,
    isFolder: false,
    size: 25165824, // 24 MB
    lastModifiedDateTime: '2026-10-22T08:00:00.000Z',
    createdDateTime: '2026-10-15T10:00:00.000Z',
    webUrl: 'https://fabrikam.sharepoint.com/doc-2',
    fileType: 'presentation',
    shared: true,
  },
];

test('formatBytes handles zero, small, and terabyte values correctly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(1073741824), '1 GB');
  assert.equal(formatBytes(1099511627776), '1 TB');
});

test('getFileCategory correctly identifies file types from extensions and MIME types', () => {
  assert.equal(getFileCategory('report.docx'), 'document');
  assert.equal(getFileCategory('budget.xlsx'), 'spreadsheet');
  assert.equal(getFileCategory('slides.pptx'), 'presentation');
  assert.equal(getFileCategory('contract.pdf'), 'pdf');
  assert.equal(getFileCategory('banner.png'), 'image');
  assert.equal(getFileCategory('archive.zip'), 'archive');
  assert.equal(getFileCategory('index.ts'), 'code');
  assert.equal(getFileCategory('unknown.xyz'), 'other');
});

test('calculateAggregateStorage totals multiple OneDrive accounts', () => {
  const result = calculateAggregateStorage(sampleAccounts);
  assert.equal(result.total, 2147483648000);
  assert.equal(result.used, 805306368000);
  assert.equal(result.remaining, 1342177280000);
  assert.equal(result.percent, 38);
});

test('matchesDateFilter and matchesSizeFilter work properly', () => {
  const now = new Date('2026-10-25T18:00:00.000Z').getTime();

  // Date filter
  assert.equal(matchesDateFilter('2026-10-25T10:00:00.000Z', 'today', now), true);
  assert.equal(matchesDateFilter('2026-10-20T10:00:00.000Z', 'today', now), false);
  assert.equal(matchesDateFilter('2026-10-20T10:00:00.000Z', '7days', now), true);
  assert.equal(matchesDateFilter('2026-08-01T10:00:00.000Z', '7days', now), false);

  // Size filter
  assert.equal(matchesSizeFilter(500000, 'small', false), true); // ~500 KB < 1MB
  assert.equal(matchesSizeFilter(5000000, 'medium', false), true); // ~5 MB in [1MB, 10MB)
  assert.equal(matchesSizeFilter(25000000, 'large', false), true); // ~25 MB in [10MB, 50MB)
  assert.equal(matchesSizeFilter(60000000, 'huge', false), true); // > 50 MB
});

test('filterItems supports advanced multi-account search, date, and size filters', () => {
  // Global search across drives
  const searchResults = filterItems(sampleItems, { search: 'balance' });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, 'doc-1');

  // Filter by size: large (10-50MB)
  const largeItems = filterItems(sampleItems, { sizeFilter: 'large' });
  assert.equal(largeItems.length, 1);
  assert.equal(largeItems[0].id, 'doc-2');

  // Filter by category
  const spreadsheets = filterItems(sampleItems, { category: 'spreadsheet' });
  assert.equal(spreadsheets.length, 1);
  assert.equal(spreadsheets[0].name, 'Q3_Balance_Sheet.xlsx');
});

test('batch operations: delete, restore, permanent delete, and move', () => {
  // Delete
  const deleted = batchDeleteItems(sampleItems, ['doc-1']);
  assert.equal(deleted.find((i) => i.id === 'doc-1')?.deleted, true);

  // Restore
  const restored = batchRestoreItems(deleted, ['doc-1']);
  assert.equal(restored.find((i) => i.id === 'doc-1')?.deleted, false);

  // Permanent delete
  const remaining = batchPermanentDeleteItems(sampleItems, ['doc-1']);
  assert.equal(remaining.length, 2);
  assert.equal(remaining.find((i) => i.id === 'doc-1'), undefined);

  // Move
  const moved = batchMoveItems(sampleItems, ['doc-2'], 'f-1', sampleAccounts[0]);
  assert.equal(moved.find((i) => i.id === 'doc-2')?.parentId, 'f-1');
  assert.equal(moved.find((i) => i.id === 'doc-2')?.accountId, 'acc-1');
});

test('applyDeltaChanges correctly reconciles delta sync additions, updates, and deletes', () => {
  const updatedDoc1: DriveItem = {
    ...sampleItems[1],
    name: 'Q3_Balance_Sheet_Final.xlsx',
    size: 2000000,
  };
  const newDoc3: DriveItem = {
    id: 'doc-3',
    name: 'New_Sales_Pipeline.docx',
    accountId: 'acc-1',
    accountName: 'Contoso Enterprise',
    accountColor: '#0284c7',
    parentId: null,
    isFolder: false,
    size: 120000,
    lastModifiedDateTime: '2026-10-25T17:00:00.000Z',
    createdDateTime: '2026-10-25T17:00:00.000Z',
    webUrl: 'https://contoso.sharepoint.com/doc-3',
    fileType: 'document',
  };

  const deltaResult = {
    addedOrUpdated: [updatedDoc1, newDoc3],
    deletedIds: ['doc-2'],
  };

  const reconciled = applyDeltaChanges(sampleItems, deltaResult);
  assert.equal(reconciled.length, 3);
  // doc-2 was deleted
  assert.equal(reconciled.find((i) => i.id === 'doc-2'), undefined);
  // doc-1 was updated
  assert.equal(reconciled.find((i) => i.id === 'doc-1')?.name, 'Q3_Balance_Sheet_Final.xlsx');
  // doc-3 was added
  assert.equal(reconciled.find((i) => i.id === 'doc-3')?.name, 'New_Sales_Pipeline.docx');
});

test('getAccountStorageDistribution calculates slices and percentages for Recharts', () => {
  const slices = getAccountStorageDistribution(sampleAccounts);
  assert.equal(slices.length, 2);
  assert.equal(slices[0].name, 'Contoso Enterprise');
  assert.equal(slices[0].percentOfUsed, 33); // 268435456000 / 805306368000 = 33.33%
  assert.equal(slices[1].name, 'Fabrikam Aerospace');
  assert.equal(slices[1].percentOfUsed, 67); // 536870912000 / 805306368000 = 66.67%
});

test('calculateStorageByCategory aggregates bytes and item counts by file type', () => {
  const categories = calculateStorageByCategory(sampleItems);
  assert.equal(categories.length, 2); // spreadsheet and presentation
  // presentation has 24 MB, spreadsheet has 1 MB
  assert.equal(categories[0].category, 'presentation');
  assert.equal(categories[0].count, 1);
  assert.equal(categories[1].category, 'spreadsheet');
  assert.equal(categories[1].count, 1);
});

