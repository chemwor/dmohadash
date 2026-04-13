alter table dmhoa_leads add column if not exists upvotes int default 0;
alter table dmhoa_leads add column if not exists num_comments int default 0;
