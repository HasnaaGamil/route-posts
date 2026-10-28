import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SuggestedFriendsComponent } from '../suggested-friends/suggested-friends.component';

@Component({
  selector: 'app-feed-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SuggestedFriendsComponent],
  templateUrl: './feed-shell.component.html',
})
export class FeedShellComponent {}