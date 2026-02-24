#!/usr/bin/env npx tsx
/**
 * Data Backfill Script
 * 
 * This script handles data migrations and backfills for the HotelOS database.
 * It can be run locally or in Railway environment.
 * 
 * Usage:
 *   npx tsx scripts/backfill-data.ts [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run   Preview changes without applying them
 *   --verbose   Show detailed output
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillResult {
  task: string;
  success: boolean;
  recordsAffected: number;
  error?: string;
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

function log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗',
    debug: '→',
  }[level];
  
  if (level === 'debug' && !isVerbose) return;
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function backfillConciergeRequestPriorities(): Promise<BackfillResult> {
  const task = 'Backfill concierge request priorities';
  log(`Starting: ${task}`, 'info');
  
  try {
    // Find requests without priority set (would be null in older records)
    const requestsToUpdate = await prisma.conciergeRequest.findMany({
      where: {
        priority: undefined,
      },
    });
    
    if (isDryRun) {
      log(`[DRY RUN] Would update ${requestsToUpdate.length} concierge requests`, 'debug');
      return { task, success: true, recordsAffected: requestsToUpdate.length };
    }
    
    // Update requests with default priority
    const result = await prisma.conciergeRequest.updateMany({
      where: {
        id: { in: requestsToUpdate.map(r => r.id) },
      },
      data: {
        priority: 'MEDIUM',
      },
    });
    
    log(`Updated ${result.count} concierge requests with default priority`, 'info');
    return { task, success: true, recordsAffected: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`Failed: ${task} - ${message}`, 'error');
    return { task, success: false, recordsAffected: 0, error: message };
  }
}

async function backfillRoomHousekeepingStatus(): Promise<BackfillResult> {
  const task = 'Backfill room housekeeping status';
  log(`Starting: ${task}`, 'info');
  
  try {
    // Find rooms without housekeeping status
    const roomsToUpdate = await prisma.room.findMany({
      where: {
        housekeepingStatus: undefined,
      },
    });
    
    if (isDryRun) {
      log(`[DRY RUN] Would update ${roomsToUpdate.length} rooms`, 'debug');
      return { task, success: true, recordsAffected: roomsToUpdate.length };
    }
    
    const result = await prisma.room.updateMany({
      where: {
        id: { in: roomsToUpdate.map(r => r.id) },
      },
      data: {
        housekeepingStatus: 'CLEAN',
      },
    });
    
    log(`Updated ${result.count} rooms with default housekeeping status`, 'info');
    return { task, success: true, recordsAffected: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`Failed: ${task} - ${message}`, 'error');
    return { task, success: false, recordsAffected: 0, error: message };
  }
}

async function backfillGuestVipStatus(): Promise<BackfillResult> {
  const task = 'Backfill guest VIP status';
  log(`Starting: ${task}`, 'info');
  
  try {
    // Find guests without VIP status
    const guestsToUpdate = await prisma.guest.findMany({
      where: {
        isVip: undefined,
      },
    });
    
    if (isDryRun) {
      log(`[DRY RUN] Would update ${guestsToUpdate.length} guests`, 'debug');
      return { task, success: true, recordsAffected: guestsToUpdate.length };
    }
    
    const result = await prisma.guest.updateMany({
      where: {
        id: { in: guestsToUpdate.map(g => g.id) },
      },
      data: {
        isVip: false,
      },
    });
    
    log(`Updated ${result.count} guests with default VIP status`, 'info');
    return { task, success: true, recordsAffected: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`Failed: ${task} - ${message}`, 'error');
    return { task, success: false, recordsAffected: 0, error: message };
  }
}

async function backfillInvoiceStatus(): Promise<BackfillResult> {
  const task = 'Backfill invoice status';
  log(`Starting: ${task}`, 'info');
  
  try {
    // Find invoices without status
    const invoicesToUpdate = await prisma.invoice.findMany({
      where: {
        status: undefined,
      },
    });
    
    if (isDryRun) {
      log(`[DRY RUN] Would update ${invoicesToUpdate.length} invoices`, 'debug');
      return { task, success: true, recordsAffected: invoicesToUpdate.length };
    }
    
    const result = await prisma.invoice.updateMany({
      where: {
        id: { in: invoicesToUpdate.map(i => i.id) },
      },
      data: {
        status: 'DRAFT',
      },
    });
    
    log(`Updated ${result.count} invoices with default status`, 'info');
    return { task, success: true, recordsAffected: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`Failed: ${task} - ${message}`, 'error');
    return { task, success: false, recordsAffected: 0, error: message };
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HotelOS Data Backfill Script');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  if (isDryRun) {
    log('Running in DRY RUN mode - no changes will be made', 'warn');
  }
  
  const results: BackfillResult[] = [];
  
  try {
    // Test database connection
    log('Testing database connection...', 'info');
    await prisma.$connect();
    log('Database connection successful', 'info');
    
    // Run all backfill tasks
    results.push(await backfillConciergeRequestPriorities());
    results.push(await backfillRoomHousekeepingStatus());
    results.push(await backfillGuestVipStatus());
    results.push(await backfillInvoiceStatus());
    
    // Summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordsAffected, 0);
    
    console.log(`  Tasks completed: ${successful}/${results.length}`);
    console.log(`  Tasks failed: ${failed}`);
    console.log(`  Records affected: ${totalRecords}`);
    
    if (failed > 0) {
      console.log('');
      console.log('  Failed tasks:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`    - ${r.task}: ${r.error}`);
      });
    }
    
    console.log('');
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`Fatal error: ${message}`, 'error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
