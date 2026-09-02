// frontend/src/app/features/player/queue-drawer.component.ts
// Painel lateral fixo para gerenciar a fila de reprodução (estilo Amazon Music).
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { PlayerService } from '../../core/services/player.service';

@Component({
  selector: 'app-queue-drawer',
  standalone: false,
  templateUrl: './queue-drawer.component.html',
  styleUrls: ['./queue-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueueDrawerComponent {
  player = inject(PlayerService);

  readonly queue = this.player.queue;
  readonly currentIndex = this.player.currentIndex;
  readonly hasQueue = computed(() => this.queue().length > 0);

  onDrop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const q = [...this.queue()];
    moveItemInArray(q, event.previousIndex, event.currentIndex);

    const items = q.map((item, idx) => ({ id: item.id, position: idx }));
    void this.player.reorderQueue(items);
  }

  removeItem(queueItemId: string): void {
    void this.player.removeFromQueue(queueItemId);
  }

  clear(): void {
    void this.player.clearQueue();
  }

  playFromQueue(item: any): void {
    const idx = this.queue().findIndex((q) => q.id === item.id);
    if (idx >= 0) this.player.playFromQueueIndex(idx);
  }

  trackById(index: number, item: any): string {
    return item.id;
  }

  formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}