tmux has-session -t wavyton 2>/dev/null || tmux new-session -d -s wavyton 'ssh root@wavyton.com'; tmux capture-pane -p -J -S 50 - -t wavyton:0.0
