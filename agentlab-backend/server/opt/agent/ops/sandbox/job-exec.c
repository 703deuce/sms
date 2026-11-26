/*
 * job-exec: setuid-root wrapper. The caller cannot choose a user.
 * It resolves the job from the current working directory
 * (/workspace/jobs/<id>/... or the host equivalent) and the uid map,
 * drops to that uid, and execs the remaining arguments.
 *
 * Usage: job-exec <command> [args...]
 */
#define _GNU_SOURCE
#include <errno.h>
#include <grp.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define MAP_PATH "/opt/agent/ops/sandbox/uid.map"
#define JOB_GID 19998
#define MAX_LINE 512

static const char *workspace_roots[] = {
    "/workspace/jobs/",
    "/opt/agent/workspace/jobs/",
    NULL
};

static void die(const char *msg) {
    fprintf(stderr, "job-exec: %s\n", msg);
    exit(77);
}

static void clear_unsafe_env(void) {
    unsetenv("LD_PRELOAD");
    unsetenv("LD_LIBRARY_PATH");
    unsetenv("LD_AUDIT");
    unsetenv("LD_DYNAMIC_WEAK");
    unsetenv("LD_DEBUG");
    unsetenv("LD_PROFILE");
    unsetenv("LD_USE_LOAD_BIAS");
    unsetenv("DYLD_INSERT_LIBRARIES");
    unsetenv("PYTHONHOME");
    unsetenv("IFS");
}

static int parse_job_from_cwd(char *job_id, size_t n) {
    char cwd[PATH_MAX], real[PATH_MAX];
    if (!getcwd(cwd, sizeof cwd))
        return -1;
    if (!realpath(cwd, real))
        strncpy(real, cwd, sizeof real), real[sizeof real - 1] = 0;
    for (int i = 0; workspace_roots[i]; i++) {
        size_t plen = strlen(workspace_roots[i]);
        if (strncmp(real, workspace_roots[i], plen) == 0) {
            const char *rest = real + plen;
            size_t len = 0;
            while (rest[len] && rest[len] != '/')
                len++;
            if (len == 0 || len >= n)
                return -1;
            memcpy(job_id, rest, len);
            job_id[len] = 0;
            if (strstr(job_id, ".."))
                return -1;
            return 0;
        }
    }
    return -1;
}

static int lookup_uid(const char *job_id, uid_t *out) {
    FILE *f = fopen(MAP_PATH, "r");
    char line[MAX_LINE];
    if (!f)
        return -1;
    while (fgets(line, sizeof line, f)) {
        char id[128];
        unsigned int uid = 0;
        if (line[0] == '#' || line[0] == '\n')
            continue;
        if (sscanf(line, "%127s %u", id, &uid) == 2 && strcmp(id, job_id) == 0) {
            fclose(f);
            if (uid < 20001 || uid > 20100) {
                return -1;
            }
            *out = (uid_t)uid;
            return 0;
        }
    }
    fclose(f);
    return -1;
}

int main(int argc, char **argv) {
    char job_id[128];
    uid_t uid;
    gid_t gid = JOB_GID;

    if (argc < 2) {
        fprintf(stderr, "usage: job-exec <command> [args...]\n");
        return 2;
    }
    if (parse_job_from_cwd(job_id, sizeof job_id) != 0)
        die("cwd is not inside a job folder (/workspace/jobs/<id>/)");
    if (lookup_uid(job_id, &uid) != 0)
        die("no uid assigned for this job (run job-init first)");

    clear_unsafe_env();

    if (setgroups(1, &gid) != 0)
        die("setgroups failed");
    if (setgid(gid) != 0)
        die("setgid failed");
    if (setuid(uid) != 0)
        die("setuid failed");
    if (getuid() != uid || geteuid() != uid)
        die("failed to drop privileges");

    execvp(argv[1], &argv[1]);
    fprintf(stderr, "job-exec: exec failed: %s\n", strerror(errno));
    return 127;
}
