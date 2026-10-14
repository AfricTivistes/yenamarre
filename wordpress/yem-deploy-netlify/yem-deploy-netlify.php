<?php
/**
 * Plugin Name: Déploiement Netlify (sites du réseau)
 * Description: Met à jour le site public Netlify d'un site du réseau quand un contenu est modifié dans WordPress. Deux modes : build hook Netlify (site statique, ex. yenamarre.sn) ou revalidation Next.js (ex. LTC). À activer site par site, pas sur tout le réseau ; chaque site a ses propres réglages (Réglages › Déploiement).
 * Version: 2.0.0
 * Author: Y'EN A MARRE
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

const YEM_DEPLOY_OPTION_URL        = 'yem_deploy_hook_url';
const YEM_DEPLOY_OPTION_MODE       = 'yem_deploy_mode';
const YEM_DEPLOY_OPTION_REVALIDATE = 'yem_deploy_revalidate_url';
const YEM_DEPLOY_OPTION_SECRET     = 'yem_deploy_secret';
const YEM_DEPLOY_OPTION_LABEL      = 'yem_deploy_site_label';
const YEM_DEPLOY_OPTION_LAST       = 'yem_deploy_last';
const YEM_DEPLOY_LOCK              = 'yem_deploy_lock';
const YEM_DEPLOY_CRON              = 'yem_deploy_cron';

/** Mode du site : « build_hook » (rebuild Netlify) ou « revalidate » (cache Next.js). */
function yem_deploy_mode() {
    return get_option(YEM_DEPLOY_OPTION_MODE, 'build_hook') === 'revalidate' ? 'revalidate' : 'build_hook';
}

/** Nom du site public affiché dans l'admin. */
function yem_deploy_label() {
    $label = trim((string) get_option(YEM_DEPLOY_OPTION_LABEL, ''));
    return $label !== '' ? $label : get_bloginfo('name');
}

/** Secondes entre deux déclenchements (les modifications rapprochées sont regroupées). */
function yem_deploy_delai() {
    return yem_deploy_mode() === 'revalidate' ? 10 : 60;
}

/** Le site est-il configuré pour son mode ? */
function yem_deploy_configure() {
    if (yem_deploy_mode() === 'revalidate') {
        return trim((string) get_option(YEM_DEPLOY_OPTION_REVALIDATE, '')) !== ''
            && (string) get_option(YEM_DEPLOY_OPTION_SECRET, '') !== '';
    }
    return trim((string) get_option(YEM_DEPLOY_OPTION_URL, '')) !== '';
}

/** Types de contenu suivis : tous les types publics, les médias et les menus. */
function yem_deploy_types() {
    $types = array_values(get_post_types(['public' => true]));
    $types = array_unique(array_merge($types, ['attachment', 'wp_navigation']));
    return apply_filters('yem_deploy_types', $types);
}

/** Envoie la requête au site public selon le mode. */
function yem_deploy_envoyer($raison) {
    if (yem_deploy_mode() === 'revalidate') {
        $url = trim((string) get_option(YEM_DEPLOY_OPTION_REVALIDATE, ''));
        wp_remote_post($url, [
            'blocking' => false,
            'timeout'  => 5,
            'headers'  => [
                'x-revalidate-secret' => (string) get_option(YEM_DEPLOY_OPTION_SECRET, ''),
                'content-type'        => 'application/json',
            ],
            'body'     => wp_json_encode(['raison' => wp_strip_all_tags($raison)]),
        ]);
        return;
    }
    $url   = trim((string) get_option(YEM_DEPLOY_OPTION_URL, ''));
    $cible = add_query_arg('trigger_title', rawurlencode('WordPress : ' . wp_strip_all_tags($raison)), $url);
    wp_remote_post($cible, ['blocking' => false, 'timeout' => 5, 'body' => '{}']);
}

/**
 * Déclenche la mise à jour. Si elle vient d'être lancée, regroupe les
 * modifications : une seule mise à jour est planifiée à la fin du délai.
 */
function yem_deploy_trigger($raison = 'Modification WordPress') {
    if (!yem_deploy_configure()) {
        return false;
    }
    if (get_transient(YEM_DEPLOY_LOCK)) {
        if (!wp_next_scheduled(YEM_DEPLOY_CRON)) {
            wp_schedule_single_event(time() + yem_deploy_delai() + 5, YEM_DEPLOY_CRON);
        }
        return false;
    }
    set_transient(YEM_DEPLOY_LOCK, 1, yem_deploy_delai());
    yem_deploy_envoyer($raison);
    update_option(YEM_DEPLOY_OPTION_LAST, [
        'date'   => current_time('mysql'),
        'raison' => $raison,
        'mode'   => yem_deploy_mode(),
    ], false);
    return true;
}

add_action(YEM_DEPLOY_CRON, function () {
    delete_transient(YEM_DEPLOY_LOCK);
    yem_deploy_trigger('Modifications groupées');
});

/** Contenu publié (ou retiré de la publication) d'un type suivi. */
function yem_deploy_post_concerne($post_id, $avant_publie = false) {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return false;
    }
    $post = get_post($post_id);
    if (!$post || !in_array($post->post_type, yem_deploy_types(), true)) {
        return false;
    }
    return in_array($post->post_status, ['publish', 'inherit'], true) || $avant_publie;
}

add_action('wp_after_insert_post', function ($post_id, $post, $update, $post_before) {
    $avant = $post_before && $post_before->post_status === 'publish';
    if (yem_deploy_post_concerne($post_id, $avant)) {
        yem_deploy_trigger(get_the_title($post_id));
    }
}, 20, 4);

// Champs ACF enregistrés (dans l'éditeur de blocs, ils arrivent dans une 2e requête).
add_action('acf/save_post', function ($post_id) {
    if (is_numeric($post_id) && yem_deploy_post_concerne((int) $post_id)) {
        yem_deploy_trigger(get_the_title((int) $post_id) . ' (champs)');
    }
}, 20);

add_action('trashed_post', function ($post_id) {
    $post = get_post($post_id);
    if ($post && in_array($post->post_type, yem_deploy_types(), true)) {
        yem_deploy_trigger('Mise à la corbeille : ' . get_the_title($post_id));
    }
});

foreach (['created_term', 'edited_term', 'delete_term'] as $hook) {
    add_action($hook, function () {
        yem_deploy_trigger('Catégories / étiquettes');
    });
}

/* ---------- Réglages › Déploiement ---------- */

add_action('admin_menu', function () {
    add_options_page('Déploiement ' . yem_deploy_label(), 'Déploiement', 'manage_options', 'yem-deploy', 'yem_deploy_page');
});

add_action('admin_init', function () {
    register_setting('yem_deploy', YEM_DEPLOY_OPTION_MODE, [
        'type'              => 'string',
        'sanitize_callback' => function ($v) {
            return $v === 'revalidate' ? 'revalidate' : 'build_hook';
        },
        'show_in_rest'      => false,
    ]);
    foreach ([YEM_DEPLOY_OPTION_URL, YEM_DEPLOY_OPTION_REVALIDATE] as $option) {
        register_setting('yem_deploy', $option, [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'show_in_rest'      => false,
        ]);
    }
    foreach ([YEM_DEPLOY_OPTION_SECRET, YEM_DEPLOY_OPTION_LABEL] as $option) {
        register_setting('yem_deploy', $option, [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'show_in_rest'      => false,
        ]);
    }
});

function yem_deploy_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $last  = get_option(YEM_DEPLOY_OPTION_LAST);
    $mode  = yem_deploy_mode();
    $label = yem_deploy_label();
    ?>
    <div class="wrap">
        <h1>Déploiement de <?php echo esc_html($label); ?></h1>
        <p>Chaque modification de contenu de ce site WordPress met à jour le site public <strong><?php echo esc_html($label); ?></strong>. Les modifications rapprochées sont regroupées.</p>
        <form method="post" action="options.php">
            <?php settings_fields('yem_deploy'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="yem_deploy_site_label">Nom du site public</label></th>
                    <td><input type="text" class="regular-text" id="yem_deploy_site_label" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_LABEL); ?>" value="<?php echo esc_attr(get_option(YEM_DEPLOY_OPTION_LABEL, '')); ?>" placeholder="<?php echo esc_attr(get_bloginfo('name')); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">Mode</th>
                    <td>
                        <label><input type="radio" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_MODE); ?>" value="build_hook" <?php checked($mode, 'build_hook'); ?>> Build hook Netlify : reconstruit le site (site statique, ex. Astro). Visible en 2 minutes environ.</label><br>
                        <label><input type="radio" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_MODE); ?>" value="revalidate" <?php checked($mode, 'revalidate'); ?>> Revalidation Next.js : vide le cache du site, sans build. Visible en quelques secondes.</label>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="yem_deploy_hook_url">URL du build hook Netlify</label></th>
                    <td>
                        <input type="url" class="large-text code" id="yem_deploy_hook_url" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_URL); ?>" value="<?php echo esc_attr(get_option(YEM_DEPLOY_OPTION_URL, '')); ?>" placeholder="https://api.netlify.com/build_hooks/…">
                        <p class="description">Mode build hook. Netlify › Site configuration › Build &amp; deploy › Build hooks.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="yem_deploy_revalidate_url">URL de revalidation</label></th>
                    <td>
                        <input type="url" class="large-text code" id="yem_deploy_revalidate_url" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_REVALIDATE); ?>" value="<?php echo esc_attr(get_option(YEM_DEPLOY_OPTION_REVALIDATE, '')); ?>" placeholder="https://ltc.yenamarre.sn/api/revalidate">
                        <p class="description">Mode revalidation. Route du site Next.js.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="yem_deploy_secret">Secret de revalidation</label></th>
                    <td>
                        <input type="password" class="regular-text code" id="yem_deploy_secret" name="<?php echo esc_attr(YEM_DEPLOY_OPTION_SECRET); ?>" value="<?php echo esc_attr(get_option(YEM_DEPLOY_OPTION_SECRET, '')); ?>" autocomplete="off">
                        <p class="description">Même valeur que la variable REVALIDATE_SECRET du site sur Netlify.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>
        <hr>
        <p><strong>Dernier déclenchement :</strong>
            <?php echo $last ? esc_html($last['date'] . ' — ' . $last['raison']) : 'aucun'; ?></p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="yem_deploy_now">
            <?php wp_nonce_field('yem_deploy_now'); ?>
            <?php submit_button('Publier ' . $label . ' maintenant', 'secondary'); ?>
        </form>
    </div>
    <?php
}

/* ---------- Bouton manuel (page de réglages + barre d'admin) ---------- */

add_action('admin_post_yem_deploy_now', function () {
    if (!current_user_can('edit_pages') || !check_admin_referer('yem_deploy_now')) {
        wp_die('Action non autorisée.');
    }
    delete_transient(YEM_DEPLOY_LOCK);
    $ok = yem_deploy_trigger('Publication manuelle');
    $retour = wp_get_referer() ?: admin_url();
    wp_safe_redirect(add_query_arg('yem_deploy', $ok ? 'ok' : 'erreur', $retour));
    exit;
});

add_action('admin_bar_menu', function ($bar) {
    if (!current_user_can('edit_pages') || !yem_deploy_configure()) {
        return;
    }
    $url = wp_nonce_url(admin_url('admin-post.php?action=yem_deploy_now'), 'yem_deploy_now');
    $bar->add_node(['id' => 'yem-deploy', 'title' => '🚀 Publier ' . esc_html(yem_deploy_label()), 'href' => $url]);
}, 100);

add_action('admin_notices', function () {
    if (!isset($_GET['yem_deploy'])) {
        return;
    }
    $ok    = $_GET['yem_deploy'] === 'ok';
    $label = yem_deploy_label();
    $delai = yem_deploy_mode() === 'revalidate' ? 'quelques secondes' : 'environ 2 minutes';
    printf(
        '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
        $ok ? 'success' : 'error',
        esc_html($ok
            ? "Mise à jour de $label lancée : visible dans $delai."
            : "Impossible de lancer la mise à jour : vérifiez les réglages (Réglages › Déploiement).")
    );
});
