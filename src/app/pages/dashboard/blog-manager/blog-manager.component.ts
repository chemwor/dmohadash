import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { BlogService, BlogIdea, BlogPost } from '../../../core/services/blog.service';

@Component({
  selector: 'app-blog-manager',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './blog-manager.component.html'
})
export class BlogManagerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private pollInterval: any = null;

  ideas: BlogIdea[] = [];
  blogs: BlogPost[] = [];
  isLoading = false;
  isGeneratingIdeas = false;
  generatingBlogId: string | null = null;
  error = '';
  successMessage = '';
  processingMessage = '';

  activeView: 'ideas' | 'blogs' = 'ideas';
  ideaFilter: 'all' | 'pending' | 'approved' | 'generated' = 'all';
  blogFilter: 'all' | 'published' | 'draft' | 'archived' = 'all';

  selectedIdea: BlogIdea | null = null;
  selectedBlog: BlogPost | null = null;

  constructor(private blogService: BlogService) {}

  ngOnInit(): void {
    this.loadIdeas();
    this.loadBlogs();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveView(view: 'ideas' | 'blogs'): void {
    this.activeView = view;
    this.selectedIdea = null;
    this.selectedBlog = null;
  }

  // Ideas
  loadIdeas(): void {
    this.isLoading = true;
    const status = this.ideaFilter === 'all' ? undefined : this.ideaFilter;

    this.blogService.getIdeas(status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.ideas = response.ideas;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.error = err.message || 'Failed to load ideas';
        }
      });
  }

  setIdeaFilter(filter: 'all' | 'pending' | 'approved' | 'generated'): void {
    this.ideaFilter = filter;
    this.loadIdeas();
  }

  generateIdeas(): void {
    this.isGeneratingIdeas = true;
    this.error = '';
    this.successMessage = '';
    this.processingMessage = 'Starting AI idea generation...';

    const initialCount = this.ideas.length;

    // Use background function for longer processing time
    this.blogService.generateIdeasBackground()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processingMessage = 'AI is generating ideas... This may take a minute.';
          // Poll for completion
          this.startPollingForIdeas(initialCount);
        },
        error: (err) => {
          this.isGeneratingIdeas = false;
          this.processingMessage = '';
          this.error = err.error?.message || err.message || 'Failed to start idea generation';
        }
      });
  }

  private startPollingForIdeas(initialCount: number): void {
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 2 minutes (60 * 2s)

    this.pollInterval = setInterval(() => {
      pollCount++;

      this.blogService.getIdeas()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            // Check if new ideas were added
            if (response.ideas.length > initialCount) {
              this.stopPolling();
              this.isGeneratingIdeas = false;
              this.processingMessage = '';
              this.ideas = response.ideas;
              const newCount = response.ideas.length - initialCount;
              this.successMessage = `Generated ${newCount} new blog ideas!`;
              setTimeout(() => this.successMessage = '', 5000);
            } else if (pollCount >= maxPolls) {
              this.stopPolling();
              this.isGeneratingIdeas = false;
              this.processingMessage = '';
              this.error = 'Idea generation is taking longer than expected. Please try again.';
            }
          },
          error: () => {
            // Continue polling on error
          }
        });
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  selectIdea(idea: BlogIdea): void {
    this.selectedIdea = this.selectedIdea?.id === idea.id ? null : idea;
  }

  approveIdea(idea: BlogIdea): void {
    this.blogService.updateIdeaStatus(idea.id, 'approved')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Idea approved! Click "Generate Blog" to create the post.';
          this.loadIdeas();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.error = err.message || 'Failed to approve idea';
        }
      });
  }

  rejectIdea(idea: BlogIdea): void {
    this.blogService.updateIdeaStatus(idea.id, 'rejected')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadIdeas();
        },
        error: (err) => {
          this.error = err.message || 'Failed to reject idea';
        }
      });
  }

  generateBlogFromIdea(idea: BlogIdea): void {
    this.generatingBlogId = idea.id;
    this.error = '';
    this.processingMessage = 'Starting blog generation...';

    // Use background function for longer processing time
    this.blogService.generateBlogFromIdeaBackground(idea.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processingMessage = 'AI is writing your blog post... This may take a minute.';
          // Poll for completion
          this.startPollingForBlog(idea.id);
        },
        error: (err) => {
          this.generatingBlogId = null;
          this.processingMessage = '';
          this.error = err.error?.message || err.message || 'Failed to start blog generation';
        }
      });
  }

  private startPollingForBlog(ideaId: string): void {
    let pollCount = 0;
    const maxPolls = 90; // Poll for up to 3 minutes (90 * 2s)

    this.pollInterval = setInterval(() => {
      pollCount++;

      this.blogService.getIdeas()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            const idea = response.ideas.find(i => i.id === ideaId);

            // Check if blog was generated
            if (idea && idea.status === 'generated') {
              this.stopPolling();
              this.generatingBlogId = null;
              this.processingMessage = '';
              this.ideas = response.ideas;
              this.loadBlogs();
              this.selectedIdea = null;
              this.successMessage = `Blog "${idea.title}" created and published!`;
              setTimeout(() => this.successMessage = '', 5000);
            } else if (idea && idea.status !== 'generating') {
              // If status changed but not to generated, there was an error
              this.stopPolling();
              this.generatingBlogId = null;
              this.processingMessage = '';
              this.error = 'Blog generation failed. Please try again.';
            } else if (pollCount >= maxPolls) {
              this.stopPolling();
              this.generatingBlogId = null;
              this.processingMessage = '';
              this.error = 'Blog generation is taking longer than expected. Please check back later.';
            }
          },
          error: () => {
            // Continue polling on error
          }
        });
    }, 2000);
  }

  deleteIdea(idea: BlogIdea): void {
    if (!confirm(`Delete idea "${idea.title}"?`)) return;

    this.blogService.deleteIdea(idea.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedIdea = null;
          this.loadIdeas();
        },
        error: (err) => {
          this.error = err.message || 'Failed to delete idea';
        }
      });
  }

  // Blogs
  loadBlogs(): void {
    const status = this.blogFilter === 'all' ? undefined : this.blogFilter;

    this.blogService.getBlogs(status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.blogs = response.blogs;
        },
        error: (err) => {
          this.error = err.message || 'Failed to load blogs';
        }
      });
  }

  setBlogFilter(filter: 'all' | 'published' | 'draft' | 'archived'): void {
    this.blogFilter = filter;
    this.loadBlogs();
  }

  selectBlog(blog: BlogPost): void {
    this.selectedBlog = this.selectedBlog?.id === blog.id ? null : blog;
  }

  updateBlogStatus(blog: BlogPost, status: 'draft' | 'published' | 'archived'): void {
    this.blogService.updateBlogStatus(blog.id, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Blog ${status}!`;
          this.loadBlogs();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.error = err.message || 'Failed to update blog';
        }
      });
  }

  deleteBlog(blog: BlogPost): void {
    if (!confirm(`Delete "${blog.title}"? This cannot be undone.`)) return;

    this.blogService.deleteBlog(blog.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedBlog = null;
          this.loadBlogs();
        },
        error: (err) => {
          this.error = err.message || 'Failed to delete blog';
        }
      });
  }

  copyBlogUrl(blog: BlogPost): void {
    const url = `/blog/${blog.slug}`;
    navigator.clipboard.writeText(url);
    this.successMessage = 'URL copied!';
    setTimeout(() => this.successMessage = '', 2000);
  }

  // Helpers
  getIdeaStatusColor(status: string): string {
    return this.blogService.getIdeaStatusColor(status);
  }

  getIdeaStatusBgColor(status: string): string {
    return this.blogService.getIdeaStatusBgColor(status);
  }

  getBlogStatusColor(status: string): string {
    return this.blogService.getBlogStatusColor(status);
  }

  getBlogStatusBgColor(status: string): string {
    return this.blogService.getBlogStatusBgColor(status);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getPendingCount(): number {
    return this.ideas.filter(i => i.status === 'pending').length;
  }

  getApprovedCount(): number {
    return this.ideas.filter(i => i.status === 'approved').length;
  }

  getPublishedCount(): number {
    return this.blogs.filter(b => b.status === 'published').length;
  }

  getTotalViews(): number {
    return this.blogs.reduce((sum, b) => sum + (b.view_count || 0), 0);
  }

  getContentPreview(content: string): string {
    return content ? content.substring(0, 500) : '';
  }
}
