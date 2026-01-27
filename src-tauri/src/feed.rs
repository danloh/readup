use bytes::Bytes;
use reqwest;
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct Channel {
    pub ty: String, // podcast || rss || opds
    pub title: String,
    pub link: String, // unique
    pub description: String,
    pub published: String,
    pub articles: Vec<Article>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Article {
    pub title: String,
    pub link: String,  // unique
    pub feed_link: String,
    pub audio_url: String,
    pub description: String,
    pub published: String,
    pub content: String,
    pub author: String,
    pub image: String,
}

#[command]
pub async fn fetch_feed(url: String) -> Option<Channel> {
    process_feed(&url, "rss", None).await 
}

// process: rss or atom typed
pub async fn process_feed(
    url: &str,
    ty: &str,
    title: Option<String>,
) -> Option<Channel> {
    match process_rss(url, ty, title.clone()).await {
        Some(res) => Some(res),
        None => process_atom(url, "atom", title).await,
    }
}

// 0- get content bytes
pub async fn get_feed_content(url: &str) -> Option<Bytes> {
    let client = reqwest::Client::builder().build();

    let response = match client {
        Ok(cl) => cl.get(url).send().await,
        Err(_e) => {
            return None;
        }
    };

    match response {
        Ok(response) => match response.status() {
            reqwest::StatusCode::OK => {
                let content = match response.bytes().await {
                    Ok(ctn) => ctn,
                    Err(_e) => {
                        return None;
                    }
                };

                Some(content)
            }
            _status => None,
        },
        Err(_e) => None,
    }
}

// 1.1 process rss
async fn process_rss(
    url: &str,
    ty: &str,
    title: Option<String>,
) -> Option<Channel> {
    if let Some(content) = get_feed_content(url).await {
        match rss::Channel::read_from(&content[..]).map(|channel| channel) {
            Ok(channel) => {
                let date = match &channel.pub_date {
                    Some(t) => String::from(t),
                    None => String::from(""),
                };
                let channel_title = match title {
                    Some(t) if t.trim().len() > 0 => String::from(t.trim()),
                    _ => channel.title.to_string(),
                };
                
                let mut articles: Vec<Article> = Vec::new();
                for item in channel.items() {
                    let title = item.title.clone().unwrap_or_else(|| String::from(""));
                    let link = item.link.clone().unwrap_or_else(|| String::from(""));
                    let description = item.description.clone().unwrap_or_default();
                    let content = item.content.clone().unwrap_or_else(|| description.clone());
                    // get audio
                    let enclosure = item.enclosure.clone().unwrap_or_default();
                    let audio_url = if enclosure.mime_type.starts_with("audio/") {
                        enclosure.url
                    } else {
                        String::new()
                    };

                    let new_article = Article {
                        title,
                        link,
                        feed_link: url.to_string(),
                        audio_url,
                        description,
                        published: String::from(item.pub_date().clone().unwrap_or("")),
                        content,
                        author: String::from(item.author().clone().unwrap_or("")),
                        image: String::from(""),
                    };

                    articles.push(new_article);
                }
                let rss_channel = Channel {
                    title: channel_title,
                    link: url.to_string(),
                    description: channel.description.to_string(),
                    published: date,
                    ty: ty.to_string(),
                    articles: articles,
                };

                Some(rss_channel)
            }
            Err(_e) => None,
        }
    } else {
        None
    }
}

// 1.2- process atom
async fn process_atom(
    url: &str,
    ty: &str,
    title: Option<String>,
) -> Option<Channel> {
    if let Some(content) = get_feed_content(url).await {
        match atom_syndication::Feed::read_from(&content[..]) {
            Ok(atom) => {
                let channel_title = match title {
                    Some(t) if t.trim().len() > 0 => String::from(t.trim()),
                    _ => atom.title.to_string(),
                };
                
                let mut articles: Vec<Article> = vec![];
                for item in atom.entries {
                    let item_url = if let Some(link) = item.links.first() {
                        link.to_owned().href
                    } else {
                        String::new()
                    };

                    let description = item.summary.unwrap_or_default().to_string();

                    let new_article = Article {
                        title: item.title.to_string(),
                        link: item_url,
                        feed_link: url.to_string(),
                        audio_url: String::from(""),
                        description: description.clone(),
                        published: item.updated.to_rfc2822(),
                        content: item
                            .content
                            .unwrap_or_default()
                            .value
                            .unwrap_or(description),
                        author: String::from(""),
                        image: String::from(""),
                    };

                    articles.push(new_article);
                }
                let atom_channel = Channel {
                    title: channel_title.clone(),
                    link: url.to_string(),
                    description: atom.subtitle.unwrap_or_default().to_string(),
                    published: atom.updated.to_string(),
                    ty: ty.to_string(),
                    articles: articles,
                };

                Some(atom_channel)
            }
            Err(_e) => None,
        }
    } else {
        None
    }
}
